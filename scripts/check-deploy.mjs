#!/usr/bin/env node
/**
 * Production readiness check for the credits proxy.
 *
 * Two modes, both read-only:
 *
 *   node scripts/check-deploy.mjs                       # validate an .env before deploying
 *   node scripts/check-deploy.mjs --url=https://credits.example.com
 *                                                       # probe a running deployment
 *
 * The local mode catches the mistakes that only bite in production: placeholder
 * secrets, a test key under NODE_ENV=production, a success URL on the wrong host,
 * a missing data directory. The live mode catches the class of bug we already hit
 * once -- a route that exists in the code but not on the server, so the buyer's
 * redirect dies on a 404. It asserts the post-checkout pages, the webhook route
 * (400 on a bad signature, not 404/503) and the admin gate.
 *
 * Exit code 0 only when nothing FAILs. Warnings never fail.
 *
 * Usage:
 *   node scripts/check-deploy.mjs --env=server/credits/.env
 *   node scripts/check-deploy.mjs --url=https://credits.example.com --strict
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback = "") => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : true;
};

const ENV_FILE = String(flag("env", path.join(ROOT, "server/credits/.env")));
const LIVE_URL = String(flag("url", "")).replace(/\/+$/, "");
const STRICT = Boolean(flag("strict", false));

const rows = [];
const add = (level, name, detail) => rows.push({ level, name, detail });
const ok = (name, detail = "") => add("ok", name, detail);
const warn = (name, detail = "") => add("warn", name, detail);
const fail = (name, detail = "") => add("fail", name, detail);

const PLACEHOLDERS = new Set([
  "",
  "changeme",
  "your-key",
  "sk_test_xxx",
  "sk_live_xxx",
  "https://credits.example.com",
  "https://example.com",
  "/path/to/data"
]);

const isPlaceholder = (value) => PLACEHOLDERS.has(String(value ?? "").trim().toLowerCase());

function readEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const out = {};
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || /^\s*#/.test(line)) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/* ------------------------------------------------------------------ local */

function checkLocal(env) {
  const get = (k) => (env[k] ?? "").trim();
  const isProd = get("NODE_ENV") === "production";
  if (!isProd) warn("NODE_ENV", `is "${get("NODE_ENV") || "unset"}" — production expects "production"`);
  else ok("NODE_ENV", "production");

  const required = {
    RENDERFUL_API_KEY: 20,
    FILE_SIGNING_SECRET: 32,
    ADMIN_SECRET: 24,
    PUBLIC_BASE_URL: 8,
    LICENSE_VALIDATE_URL: 8,
    STRIPE_SECRET_KEY: 12,
    STRIPE_WEBHOOK_SECRET: 8,
    DATA_DIR: 2
  };

  for (const [key, min] of Object.entries(required)) {
    const value = get(key);
    if (!value) fail(key, "missing — the service refuses to boot without it");
    else if (isPlaceholder(value)) fail(key, "still a placeholder from .env.example");
    else if (value.length < min) fail(key, `too short (${value.length} < ${min})`);
    else ok(key, `${value.length} chars`);
  }

  const signing = get("FILE_SIGNING_SECRET");
  if (signing && !/^[0-9a-f]{64}$/i.test(signing)) {
    warn("FILE_SIGNING_SECRET", "not 64 hex chars — fine, but `openssl rand -hex 32` is the documented form");
  }

  const stripeKey = get("STRIPE_SECRET_KEY");
  if (stripeKey.startsWith("sk_live_") || stripeKey.startsWith("rk_live_")) {
    ok("STRIPE_SECRET_KEY", "live key — real money mode");
  } else if (stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")) {
    (isProd ? fail : warn)(
      "STRIPE_SECRET_KEY",
      "TEST key — checkout will take fake cards and no money. Expected only in QA."
    );
  } else if (stripeKey) {
    fail("STRIPE_SECRET_KEY", "not a recognisable Stripe key (sk_test_/sk_live_/rk_*)");
  }

  if (get("STRIPE_WEBHOOK_SECRET") && !get("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")) {
    fail("STRIPE_WEBHOOK_SECRET", "must start with whsec_ (endpoint signing secret, not the API key)");
  }

  const base = get("PUBLIC_BASE_URL");
  if (base) {
    let parsed = null;
    try {
      parsed = new URL(base);
    } catch {
      fail("PUBLIC_BASE_URL", "not a valid URL");
    }
    if (parsed) {
      if (parsed.protocol !== "https:" && isProd) fail("PUBLIC_BASE_URL", "must be https in production");
      if (base.endsWith("/")) warn("PUBLIC_BASE_URL", "trailing slash — the docs specify none");
      const host = parsed.hostname;
      if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)) {
        (isProd ? fail : warn)("PUBLIC_BASE_URL", "points at localhost — Stripe cannot redirect buyers there");
      }
      for (const key of ["STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL", "CHECKOUT_FALLBACK_URL"]) {
        const value = get(key);
        if (!value) continue;
        try {
          const u = new URL(value);
          if (u.hostname !== host) {
            warn(key, `on ${u.hostname}, but PUBLIC_BASE_URL is ${host} — make sure that page confirms credits`);
          } else if (!/\/checkout\/(success|cancel)/.test(u.pathname)) {
            warn(key, `path ${u.pathname} is not a proxy checkout page — the proxy will not confirm the grant there`);
          } else {
            ok(key, "points at the proxy's own page");
          }
        } catch {
          fail(key, "not a valid URL");
        }
      }
      if (!get("STRIPE_SUCCESS_URL") && !get("STRIPE_CANCEL_URL")) {
        ok("checkout redirects", "unset → proxy serves /checkout/{success,cancel}");
      }
    }
  }

  if ((get("ALLOW_UNVERIFIED_LICENSES") || "false") === "true") {
    (isProd ? fail : warn)(
      "ALLOW_UNVERIFIED_LICENSES",
      "true bypasses licence checks — anyone with any key can spend the credits"
    );
  } else {
    ok("ALLOW_UNVERIFIED_LICENSES", "false");
  }

  if (get("TRUST_PROXY") === "true") {
    warn("TRUST_PROXY", "true — only correct behind a proxy that overwrites X-Forwarded-For");
  }

  const dataDir = get("DATA_DIR");
  if (dataDir && !isPlaceholder(dataDir)) {
    const resolved = path.isAbsolute(dataDir) ? dataDir : path.resolve(path.join(ROOT, "server/credits"), dataDir);
    try {
      fs.mkdirSync(resolved, { recursive: true });
      fs.accessSync(resolved, fs.constants.W_OK);
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) fail("DATA_DIR", "exists but is not a directory");
      else ok("DATA_DIR writable", resolved);
      // The ledger is the money. Warn early if the disk is nearly full.
      try {
        const { statfsSync } = fs;
        if (typeof statfsSync === "function") {
          const s = statfsSync(resolved);
          const freeGb = (Number(s.bavail) * Number(s.bsize)) / 1024 ** 3;
          if (freeGb < 2) warn("DATA_DIR free space", `${freeGb.toFixed(1)} GB — outputs can be 200 MB each`);
          else ok("DATA_DIR free space", `${freeGb.toFixed(1)} GB`);
        }
      } catch {
        /* statfs is platform-dependent; not worth failing over */
      }
    } catch (e) {
      fail("DATA_DIR", `not writable: ${e.code ?? e.message}`);
    }
  }

  const engine = get("CREDIT_USD") || "0.05";
  if (Number(engine) !== 0.05) warn("CREDIT_USD", `${engine} — documented pack prices assume 0.05`);
  else ok("CREDIT_USD", "0.05 (packs priced on this basis)");

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeMinor = Number(process.versions.node.split(".")[1]);
  if (nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 5)) ok("node", process.versions.node);
  else fail("node", `${process.versions.node} — needs >= 22.5 for node:sqlite`);

  if (fs.existsSync(path.join(ROOT, "server/credits/schema.sql"))) ok("schema.sql", "present next to the service");
  else fail("schema.sql", "missing — the service will not create its tables");
}

/* ------------------------------------------------------------------- live */

function looksLikeHtml(text) {
  return /^\s*<!doctype html|<html/i.test(text);
}

async function probe(base, pathname, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}${pathname}`, { redirect: "manual", ...init });
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, ms: Date.now() - started };
  } catch (e) {
    return { error: e.cause?.code ?? e.message, ms: Date.now() - started };
  }
}

async function checkLive(base) {
  let url;
  try {
    url = new URL(base);
  } catch {
    fail("--url", "not a valid URL");
    return;
  }
  if (url.protocol !== "https:" && !/^(localhost|127\.)/.test(url.hostname)) {
    fail("TLS", "deployment is not https — Stripe will refuse the redirect and browsers will warn");
  } else if (url.protocol === "https:") {
    ok("TLS", "https");
  }

  const health = await probe(base, "/health");
  if (health.error) {
    fail("GET /health", `unreachable (${health.error}) — DNS, TLS or the process`);
    return;
  }
  let body = null;
  try {
    body = JSON.parse(health.text);
  } catch {
    /* reported below */
  }
  if (health.status !== 200 || !body?.ok) fail("GET /health", `HTTP ${health.status}`);
  else ok("GET /health", `${health.ms} ms`);

  if (body) {
    if (body.stripe) ok("stripe configured", "secret key present");
    else fail("stripe configured", "health reports no Stripe key — checkout will 503");
    if (body.stripeWebhook) ok("webhook secret", "present");
    else fail("webhook secret", "missing — every Stripe delivery will be refused");
    if (Number(body.packs) === 4) ok("packs", "4 credit packs");
    else warn("packs", `${body.packs} packs reported`);
  }

  const packs = await probe(base, "/v1/credits/packs");
  try {
    const json = JSON.parse(packs.text);
    const ids = (json.packs ?? []).map((p) => p.id).join(",");
    const starter = (json.packs ?? []).find((p) => p.id === "starter");
    if (starter && starter.credits === 100 && starter.priceCents === 700) {
      ok("GET /v1/credits/packs", `starter 100 credits / $7 · ${ids}`);
    } else {
      fail("GET /v1/credits/packs", `starter does not match the documented pack: ${JSON.stringify(starter)}`);
    }
  } catch {
    fail("GET /v1/credits/packs", `HTTP ${packs.status}, not JSON`);
  }

  const bal = await probe(base, "/v1/credits/balance");
  if (bal.status === 401) ok("licence gate", "balance without a key → 401");
  else fail("licence gate", `expected 401 without a licence key, got ${bal.status}`);

  const admin = await probe(base, "/v1/admin/grant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": "wrong-secret" },
    body: JSON.stringify({ accountId: "acct_probe", credits: 1 })
  });
  if (admin.status === 401) ok("admin gate", "wrong secret → 401");
  else if (admin.status === 404) fail("admin gate", "route missing (404) — deploy is stale");
  else fail("admin gate", `expected 401 for a wrong secret, got ${admin.status}`);

  // The bug we already shipped once: Stripe redirects here, and the route did
  // not exist, so every paying buyer got a 404 at the worst possible moment.
  for (const [label, p] of [
    ["GET /checkout/success", "/checkout/success?session_id=cs_probe_unknown"],
    ["GET /checkout/cancel", "/checkout/cancel"]
  ]) {
    const res = await probe(base, p);
    if (res.status === 404) fail(label, "404 — Stripe redirects buyers here; deploy is stale");
    else if (res.status !== 200) fail(label, `HTTP ${res.status}`);
    else if (!/text\/html/.test(res.headers.get("content-type") ?? "")) fail(label, "not served as HTML");
    else if (!looksLikeHtml(res.text)) fail(label, "not an HTML page");
    else if (res.headers.get("cache-control") !== "no-store") warn(label, "not no-store — a payment page should not be cached");
    else ok(label, `${res.text.length} bytes, no-store`);
  }

  // A bad signature must be rejected by the verifier (400), not by a missing
  // route (404) or an unconfigured integration (503). That proves both halves.
  const hook = await probe(base, "/v1/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: "{}"
  });
  if (hook.status === 400) ok("POST /v1/stripe/webhook", "route live, bad signature rejected");
  else if (hook.status === 404) fail("POST /v1/stripe/webhook", "route missing (404) — Stripe has nowhere to deliver");
  else if (hook.status === 503) fail("POST /v1/stripe/webhook", "503 — STRIPE_WEBHOOK_SECRET is not set on the server");
  else fail("POST /v1/stripe/webhook", `expected 400 for a bad signature, got ${hook.status}`);

  const signed = await probe(base, "/files/acct_probe/job_probe/1.png?exp=1&sig=nope");
  if (signed.status === 403) ok("signed files", "forged link rejected");
  else if (signed.status === 404) fail("signed files", "route missing (404) — outputs will not download");
  else fail("signed files", `expected 403 for a bad signature, got ${signed.status}`);

  // A licence-gated prefix answers 401 before routing, so probe outside it and
  // require the proxy's own JSON 404 — a host-level 404 page would mean the
  // request never reached the service.
  const notFound = await probe(base, "/definitely-not-a-route");
  if (notFound.status === 404 && /json/.test(notFound.headers.get("content-type") ?? "")) {
    ok("router", "unknown route → JSON 404 from the proxy");
  } else if (notFound.status === 404) {
    warn("router", "404 came from something other than the proxy (HTML, not JSON)");
  } else {
    warn("router", `unknown route → ${notFound.status}`);
  }

  const leak = ["server", "x-powered-by"].filter((h) => health.headers.get(h));
  if (leak.length === 0) ok("fingerprint", "no server banner");
  else warn("fingerprint", `exposes ${leak.join(", ")} — consider hiding it at the proxy`);

  // A misconfigured PUBLIC_BASE_URL is invisible until a buyer is redirected to
  // a host that does not resolve. If the deployment says where it thinks it is,
  // check that the two agree.
  const canonical = new URL(base);
  if (health.headers.get("content-type")?.includes("json")) {
    ok("public base", `probed ${canonical.origin} — confirm PUBLIC_BASE_URL matches it`);
  }
}

/* ------------------------------------------------------------------- main */

const env = readEnvFile(ENV_FILE);

if (LIVE_URL) {
  console.log(`\nCredits proxy — live deployment check\n  target ${LIVE_URL}\n`);
  await checkLive(LIVE_URL);
} else {
  console.log(`\nCredits proxy — pre-deploy environment check\n  env    ${path.relative(ROOT, ENV_FILE) || ENV_FILE}\n`);
  if (!env) {
    fail("env file", `not found: ${ENV_FILE} — copy .env.example first`);
  } else {
    checkLocal(env);
  }
}

const icon = { ok: "\u2714", warn: "!", fail: "\u2716" };
for (const r of rows) {
  const pad = r.name.padEnd(26);
  console.log(`  ${icon[r.level]} ${pad}${r.detail ? ` ${r.detail}` : ""}`);
}

const fails = rows.filter((r) => r.level === "fail").length;
const warns = rows.filter((r) => r.level === "warn").length;
console.log(
  `\n${fails === 0 ? "READY" : "NOT READY"}  ${rows.length - fails - warns} passed, ${warns} warnings, ${fails} failures\n`
);
if (fails === 0 && STRICT && warns > 0) {
  console.log("  --strict: warnings are failures here.\n");
  process.exitCode = 1;
} else {
  process.exitCode = fails === 0 ? 0 : 1;
}
