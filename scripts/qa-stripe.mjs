#!/usr/bin/env node
/**
 * End-to-end Stripe checkout QA in **test mode**.
 *
 * Proves the part the offline harness cannot: that Stripe itself accepts our
 * session, that its own signed webhook lands on the proxy, and that the grant
 * then survives a refund.
 *
 * Flow: starts `stripe listen` → boots the real proxy with that signing secret
 * → creates a Starter checkout → waits for you to pay with 4242 4242 4242 4242
 * → asserts the webhook granted exactly 100 credits → refunds the payment and
 * checks the ledger policy.
 *
 * Refuses to run with an `sk_live_` key. Nothing here can move real money.
 *
 * Usage:
 *   node scripts/qa-stripe.mjs                  # reads server/credits/.env.qa
 *   node scripts/qa-stripe.mjs --timeout=600    # seconds to wait for payment
 *   node scripts/qa-stripe.mjs --keep-data      # keep data-qa between runs
 *
 * The secret key is read from the env file or STRIPE_SECRET_KEY, never printed.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = path.join(ROOT, "server/credits");
const ENV_FILE = path.join(SERVER_DIR, ".env.qa");
const DATA_DIR = path.join(SERVER_DIR, "data-qa");
const LICENSE_KEY = "qa-stripe-license-key-0001";
const PACK = "starter";
const PACK_CREDITS = 100;
const PACK_CENTS = 700;

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const TIMEOUT_SEC = Number(argValue("timeout", "300"));
const KEEP_DATA = args.includes("--keep-data");

const results = [];
function step(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  \u2714 ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`  \u2716 ${name} — ${detail}`);
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

/* ------------------------------------------------------------------- config */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile(ENV_FILE);
const key = (process.env.STRIPE_SECRET_KEY || fileEnv.STRIPE_SECRET_KEY || "").trim();

/* --------------------------------------------------------------- preflight */
function preflight() {
  if (!key) {
    console.error(`
No Stripe secret key found.

  1. Open ${path.relative(ROOT, ENV_FILE)}
  2. Put your TEST-MODE key on the STRIPE_SECRET_KEY= line (sk_test_...)
     Stripe dashboard -> Developers -> API keys -> toggle "Test mode"
  3. Re-run: npm run qa:stripe

Nothing is charged in test mode.
`);
    process.exit(1);
  }
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    console.error(`
Refusing to run: that is a LIVE Stripe key (${key.slice(0, 8)}...).

This harness creates real Checkout Sessions and refunds. In live mode that is
real money and a real ledger. Use the Test mode toggle to copy an sk_test_ key.
`);
    process.exit(1);
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    console.error(`Refusing to run: "${key.slice(0, 6)}..." is not a recognised Stripe test key (sk_test_ / rk_test_).`);
    process.exit(1);
  }
}

function findStripeCli() {
  const explicit = process.env.STRIPE_CLI || argValue("stripe-bin", "");
  const candidates = [explicit, process.platform === "win32" ? "stripe.exe" : "stripe", "stripe"].filter(Boolean);
  for (const candidate of candidates) {
    const looksLikePath = candidate.includes(path.sep) || candidate.includes("/") || /^[A-Za-z]:/.test(candidate);
    if (looksLikePath && !fs.existsSync(candidate)) continue;
    return candidate;
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/* ---------------------------------------------------------------- stripe API */
async function stripeApi(pathname, { method = "GET", form } = {}) {
  const body = form ? new URLSearchParams(form) : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Stripe ${method} /v1/${pathname} -> ${res.status}: ${json?.error?.message ?? "unknown"}`);
  return json;
}

/* ------------------------------------------------------------------ process */
function spawnCapture(cmd, argv, options = {}) {
  const child = spawn(cmd, argv, { windowsHide: true, ...options });
  let out = "";
  const onData = (d) => {
    out += d;
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  return { child, output: () => out };
}

function waitFor(probe, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const value = await probe();
        if (value) return resolve(value);
      } catch {
        /* keep waiting */
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out after ${timeoutMs}ms`));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function api(base, pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      "x-license-key": LICENSE_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text };
}

/* ------------------------------------------------------------------- runner */
async function main() {
  preflight();

  const stripeCli = findStripeCli();
  if (!stripeCli) {
    console.error("The Stripe CLI is required to receive the real webhook. Set STRIPE_CLI to stripe.exe.");
    process.exit(1);
  }

  if (!KEEP_DATA && fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const forward = `${base}/v1/stripe/webhook`;

  console.log(`\nStripe test-mode checkout QA\n  proxy  ${base}\n  pack   ${PACK} · ${PACK_CREDITS} credits · $${(PACK_CENTS / 100).toFixed(2)}\n`);

  // 1. stripe listen -> signing secret for the forwarded endpoint
  const listen = spawnCapture(stripeCli, ["listen", "--api-key", key, "--forward-to", forward]);
  let webhookSecret = "";
  try {
    webhookSecret = await waitFor(
      () => /(whsec_[A-Za-z0-9]+)/.exec(listen.output())?.[1] ?? null,
      { timeoutMs: 30000 }
    );
    step("stripe listen is forwarding to the proxy", `signing secret ${webhookSecret.slice(0, 12)}…`);
  } catch (e) {
    fail("stripe listen started", `${e.message} :: ${listen.output().slice(-300)}`);
    listen.child.kill();
    process.exit(1);
  }

  // 2. real proxy with that secret
  const proxy = spawnCapture(process.execPath, [path.join(SERVER_DIR, "src/server.mjs")], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      ENV_FILE,
      PORT: String(port),
      HOST: "127.0.0.1",
      PUBLIC_BASE_URL: base,
      DATA_DIR: "./data-qa",
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      STRIPE_SECRET_KEY: key
    }
  });

  const cleanup = () => {
    try {
      proxy.child.kill();
    } catch {
      /* ignore */
    }
    try {
      listen.child.kill();
    } catch {
      /* ignore */
    }
  };

  try {
    const health = await waitFor(async () => {
      const res = await fetch(`${base}/health`);
      return res.ok ? res.json() : null;
    }, { timeoutMs: 20000 }).catch((e) => {
      throw new Error(`proxy did not start: ${e.message} :: ${proxy.output().slice(-300)}`);
    });
    assert(health.stripe, "proxy reports no Stripe key");
    assert(health.stripeWebhook, "proxy reports no webhook secret");
    step("proxy is live with Stripe + webhook configured", `packs ${health.packs}`);

    // 3. checkout session
    const before = await api(base, "/v1/credits/balance");
    assert(before.status === 200, `balance -> ${before.status}`);
    assert(before.body.balance === 0, `expected a fresh zero balance, got ${before.body.balance}`);

    const checkout = await api(base, "/v1/credits/checkout", { method: "POST", body: { packId: PACK } });
    assert(checkout.status === 200, `checkout -> ${checkout.status} ${checkout.text.slice(0, 200)}`);
    assert(checkout.body.provider === "stripe", `provider ${checkout.body.provider}`);
    assert(/^https:\/\/checkout\.stripe\.com\//.test(checkout.body.url ?? ""), `unexpected url ${checkout.body.url}`);
    assert(/^cs_test_/.test(checkout.body.sessionId ?? ""), `expected a test session, got ${checkout.body.sessionId}`);
    step("checkout session created", checkout.body.sessionId);

    // 4. Stripe's own view of the session
    const session = await stripeApi(`checkout/sessions/${checkout.body.sessionId}?expand[]=line_items`);
    assert(session.amount_total === PACK_CENTS, `amount_total ${session.amount_total}`);
    assert(session.currency === "usd", `currency ${session.currency}`);
    assert(session.mode === "payment", `mode ${session.mode}`);
    assert(session.metadata?.intent_id === checkout.body.intentId, `metadata.intent_id ${session.metadata?.intent_id}`);
    assert(session.client_reference_id === checkout.body.intentId, "client_reference_id mismatch");
    assert(session.success_url === `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, `success_url ${session.success_url}`);
    assert(session.cancel_url === `${base}/checkout/cancel`, `cancel_url ${session.cancel_url}`);
    const lineItem = session.line_items?.data?.[0] ?? {};
    assert(JSON.stringify(lineItem).includes("Starter"), `line item is not the Starter pack: ${JSON.stringify(lineItem).slice(0, 200)}`);
    assert(JSON.stringify(lineItem).includes("100"), "line item does not mention 100 credits");
    step("Stripe accepted the session and echoed our metadata", `$${(session.amount_total / 100).toFixed(2)} ${session.currency} · ${session.status}`);

    console.log(`\n  PAY NOW → ${checkout.body.url}\n`);
    console.log(`  Card 4242 4242 4242 4242 · any future expiry · any CVC · any postcode`);
    console.log(`  Waiting up to ${TIMEOUT_SEC}s for Stripe's webhook…\n`);

    // 5. wait for the webhook grant
    let balance = 0;
    try {
      balance = await waitFor(async () => {
        const res = await api(base, "/v1/credits/balance");
        return res.body?.balance >= PACK_CREDITS ? res.body.balance : null;
      }, { timeoutMs: TIMEOUT_SEC * 1000, intervalMs: 2000 });
      step("Stripe's signed webhook granted the pack", `balance ${balance}`);
    } catch {
      throw new Error(`no webhook after ${TIMEOUT_SEC}s — did you complete the payment?`);
    }

    assert(balance === PACK_CREDITS, `expected exactly ${PACK_CREDITS} credits, got ${balance}`);

    const history = await api(base, "/v1/credits/history?limit=20");
    const purchases = history.body.entries.filter((e) => e.op === "purchase");
    assert(purchases.length === 1, `expected 1 purchase entry, got ${purchases.length}`);
    assert(purchases[0].credits === PACK_CREDITS, `purchase credits ${purchases[0].credits}`);
    assert(purchases[0].pack_id === PACK, `purchase pack ${purchases[0].pack_id}`);
    step("ledger has one purchase entry", `+${purchases[0].credits} · ${purchases[0].pack_id}`);

    // 6. landing page the buyer actually lands on
    const landing = await fetch(`${base}/checkout/success?session_id=${encodeURIComponent(checkout.body.sessionId)}`);
    const landingHtml = await landing.text();
    assert(landing.status === 200, `landing page -> ${landing.status}`);
    assert(/Payment received/.test(landingHtml), "landing page missing heading");
    assert(/in the balance now/.test(landingHtml), "landing page does not confirm the credit");
    step("success page confirms the grant", `${landingHtml.length} bytes of HTML`);

    // 7. refund, and document the policy
    const paidSession = await stripeApi(`checkout/sessions/${checkout.body.sessionId}`);
    const paymentIntent = paidSession.payment_intent;
    assert(paymentIntent, "session has no payment_intent to refund");
    const refund = await stripeApi("refunds", {
      method: "POST",
      form: { payment_intent: paymentIntent, reason: "requested_by_customer" }
    });
    assert(refund.status === "succeeded" || refund.status === "pending", `refund status ${refund.status}`);
    step("payment refunded in Stripe", `${refund.id} · ${refund.status} · $${(refund.amount / 100).toFixed(2)}`);

    const afterRefund = await api(base, "/v1/credits/balance");
    assert(afterRefund.body.balance === PACK_CREDITS, `balance moved after refund: ${afterRefund.body.balance}`);
    step("refund does not auto-clawback credits (policy)", `balance still ${afterRefund.body.balance}`);
  } finally {
    cleanup();
    if (!KEEP_DATA) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        fs.rmSync(DATA_DIR, { recursive: true, force: true });
      } catch {
        /* Windows holds the sqlite file briefly; harmless */
      }
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed === 0 ? "PASS" : "FAIL"}  ${results.length - failed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`\n  Test mode verified end to end: Stripe accepted the session, delivered a real`);
    console.log(`  signed webhook, the ledger granted exactly ${PACK_CREDITS} credits, the buyer's landing`);
    console.log(`  page confirmed it, and the refund left the balance alone.\n`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(`\nFAIL  ${e.message}\n`);
  process.exitCode = 1;
});
