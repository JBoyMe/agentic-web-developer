#!/usr/bin/env node
/**
 * End-to-end QA for the managed-credits proxy.
 *
 * Runs the real proxy (real HTTP server, SQLite ledger, pricing, storage, signed
 * URLs, Stripe webhook verifier) against a **local fake Renderful upstream**, so
 * the full quote -> reserve -> generate -> poll -> settle/refund -> download ->
 * signed-URL path is exercised without spending money or calling Stripe.
 *
 * The fake upstream serves a deterministic catalogue whose USD ranges match the
 * live Renderful prices documented in skill/references/asset-credits.md. Live
 * catalogue drift is checked separately by `npm run qa:catalog`.
 *
 * Usage:
 *   node scripts/qa-credits.mjs
 *   node scripts/qa-credits.mjs --keep     (leave the temp data dir on disk)
 *
 * Exit code is non-zero if any assertion fails.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../server/credits/src/config.mjs";
import { createApp } from "../server/credits/src/server.mjs";
import { createLogger } from "../server/credits/src/log.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEEP = process.argv.includes("--keep");

const LICENSE_KEY = "qa-license-local-test-key-0001";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-credits-qa-"));
const dataDir = path.join(tmpDir, "data");
fs.mkdirSync(dataDir, { recursive: true });

/* ------------------------------------------------------------------ helpers */
const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`  \u2714 ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`  \u2716 ${name} — ${e.message}`);
    return false;
  }
}
async function checkAsync(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`  \u2714 ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`  \u2716 ${name} — ${e.message}`);
    return false;
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};
const eq = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/* --------------------------------------------------- deterministic catalogue */
// USD ranges copied from the live Renderful /models response (2026-10-26) and
// the same values published in skill/references/asset-credits.md.
const CATALOG = [
  { id: "flux-schnell", name: "FLUX.1 Schnell", provider: "Black Forest Labs", type: "text-to-image", cost: { min: 0.003, max: 0.012 } },
  { id: "flux-dev", name: "FLUX.1 Dev", provider: "Black Forest Labs", type: "text-to-image", cost: { min: 0.025, max: 0.1 } },
  { id: "seedream-4.5", name: "Seedream 4.5", provider: "ByteDance", type: "text-to-image", cost: { min: 0.04, max: 0.16 } },
  { id: "eleven_flash_v2", name: "ElevenLabs Flash v2", provider: "ElevenLabs", type: "text-to-audio", cost: { min: 0.05, max: 0.2 } },
  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro", provider: "ByteDance", type: "text-to-video", cost: { min: 0.13, max: 0.26 } },
  { id: "hunyuan3d-v2-mini", name: "Hunyuan3D v2 mini", provider: "Tencent", type: "image-to-3d", cost: { min: 0.1, max: 0.4 } }
];
const byId = new Map(CATALOG.map((m) => [m.id, m]));

const PNG = Buffer.alloc(4096);
for (let i = 0; i < PNG.length; i += 1) PNG[i] = (i * 31 + 7) & 0xff;
const MP3 = Buffer.alloc(2048, 0x55);

/* ------------------------------------------------------------ fake upstream */
function startFakeRenderful() {
  /** @type {Map<string, {polls:number, body:any, cost:number, outcome:string}>} */
  const jobs = new Map();
  let seq = 0;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fake");
    const send = (status, body, headers = {}) => {
      const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
      res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers });
      res.end(payload);
    };

    if (req.method === "GET" && url.pathname === "/api/v1/models") {
      return send(200, { models: CATALOG });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/generations") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const model = byId.get(body.model);
      if (!model) return send(400, { message: `unknown model ${body.model}` });
      const prompt = String(body.prompt ?? "").toLowerCase();
      const outcome = prompt.includes("fail")
        ? "fail"
        : prompt.includes("baddownload")
          ? "baddownload"
          : prompt.includes("overage")
            ? "overage"
            : "ok";
      // "overage" charges $0.06 for a model quoted at $0.003–0.012 (1 credit),
      // so settlement has to take a second credit.
      const cost = outcome === "overage" ? 0.06 : model.cost.min;
      const id = `gen_${++seq}`;
      jobs.set(id, { polls: 0, body, cost, outcome });
      return send(202, { id, status: "queued", model: body.model, type: body.type, cost, cost_formatted: `$${cost.toFixed(4)}` });
    }

    const poll = /^\/api\/v1\/generations\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (req.method === "GET" && poll) {
      const job = jobs.get(poll[1]);
      if (!job) return send(404, { message: "generation not found" });
      job.polls += 1;
      if (job.outcome === "fail") {
        return send(200, { id: poll[1], status: "failed", error: "upstream rejected the prompt", cost: job.cost });
      }
      if (job.polls === 1) return send(200, { id: poll[1], status: "processing", cost: job.cost });
      const kind = String(job.body.type).includes("audio") ? "mp3" : "png";
      const urlPath =
        job.outcome === "baddownload" ? `/missing/${poll[1]}.${kind}` : `/out/${poll[1]}.${kind}`;
      return send(200, {
        id: poll[1],
        status: "completed",
        cost: job.cost,
        outputs: [{ url: `${fakeBase}${urlPath}`, content_type: kind === "mp3" ? "audio/mpeg" : "image/png" }]
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/out/")) {
      const isAudio = url.pathname.endsWith(".mp3");
      return send(200, isAudio ? MP3 : PNG, {
        "Content-Type": isAudio ? "audio/mpeg" : "image/png",
        "Content-Length": String((isAudio ? MP3 : PNG).length)
      });
    }

    return send(404, { message: `fake upstream: no route ${req.method} ${url.pathname}` });
  });

  let fakeBase = "";
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      fakeBase = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, base: fakeBase });
    });
  });
}

/* ------------------------------------------------------------------- runner */
let fakeBase = "";
let app;
let base = "";
let passed = 0;
let failed = 0;

function record(ok) {
  if (ok) passed += 1;
  else failed += 1;
}

async function api(pathname, { method = "GET", body, headers = {}, auth = true } = {}) {
  const init = { method, headers: { ...headers } };
  if (auth) init.headers["x-license-key"] = LICENSE_KEY;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${pathname}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

function stripeSign(payload, secret, t = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

async function deliverEvent(event, secret) {
  const raw = JSON.stringify(event);
  return fetch(`${base}/v1/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": stripeSign(raw, secret) },
    body: raw
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}

const eventFor = ({ id, intentId, amount, paymentStatus = "paid", metadata = true }) => ({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_${id}`,
      object: "checkout.session",
      payment_status: paymentStatus,
      amount_total: amount,
      client_reference_id: intentId,
      ...(metadata ? { metadata: { intent_id: intentId } } : {})
    }
  }
});

async function main() {
  const fake = await startFakeRenderful();
  fakeBase = fake.base;
  const port = await freePort();

  const adminSecret = `qa-admin-${crypto.randomBytes(12).toString("hex")}`;
  const webhookSecret = `whsec_qa_${crypto.randomBytes(16).toString("hex")}`;
  const signingSecret = crypto.randomBytes(32).toString("hex");

  const env = {
    NODE_ENV: "development",
    PORT: String(port),
    HOST: "127.0.0.1",
    PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    DATA_DIR: dataDir,
    LOG_LEVEL: "warn",
    ALLOW_ORIGIN: "*",
    TRUST_PROXY: "false",
    RENDERFUL_API_KEY: "rf_qa_placeholder_not_a_real_key",
    RENDERFUL_BASE: `${fakeBase}/api/v1`,
    RENDERFUL_TIMEOUT_MS: "5000",
    MODELS_TTL_MS: "60000",
    CREDIT_USD: "0.05",
    PRICING_BASIS: "max",
    ALLOW_UNKNOWN_MODELS: "false",
    // No live licence call: dev mode accepts any key >= 8 chars.
    LICENSE_VALIDATE_URL: "",
    ALLOW_UNVERIFIED_LICENSES: "true",
    LICENSE_SKILL: "agentic-web-developer",
    LICENSE_PLAN: "pro",
    // No Stripe API key on purpose: this run must not create live Stripe calls.
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_SUCCESS_URL: "https://skills.animotion.click/credits?status=success&session_id={CHECKOUT_SESSION_ID}",
    STRIPE_CANCEL_URL: "https://skills.animotion.click/credits?status=cancelled",
    STRIPE_TOLERANCE_SEC: "300",
    CHECKOUT_FALLBACK_URL: "https://skills.animotion.click/credits",
    FILE_SIGNING_SECRET: signingSecret,
    FILE_URL_TTL_SEC: "3600",
    MAX_OUTPUT_BYTES: String(8 * 1024 * 1024),
    ADMIN_SECRET: adminSecret,
    RATE_LIMIT_ENABLED: "true",
    RATE_LIMIT_PER_MIN: "1000",
    MAX_BODY_BYTES: String(1024 * 1024),
    // No background poller in this harness; every GET job polls on demand.
    POLL_INTERVAL_MS: "3600000",
    POLL_MIN_INTERVAL_MS: "0",
    MAX_POLL_BATCH: "5",
    TIMEOUT_IMAGE_MS: "120000",
    TIMEOUT_AUDIO_MS: "180000"
  };

  const config = loadConfig(env);
  const log = createLogger(config.logLevel);

  // Virtual clock for signed-URL expiry only (jobs keep wall-clock time).
  let clockOffsetMs = 0;
  const signedNow = () => Date.now() + clockOffsetMs;

  app = createApp({ config, log, signedNow });
  await new Promise((resolve, reject) => {
    app.server.once("error", reject);
    app.server.listen(port, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${port}`;

  console.log(`\nAWD credits proxy QA\n  proxy   ${base}\n  fake    ${fakeBase}\n  data    ${dataDir}\n`);

  /* ------------------------------------------------------------- 1. health */
  console.log("Health & catalogue");
  record(
    await checkAsync("health reports every integration", async () => {
      const r = await api("/health", { auth: false });
      eq(r.status, 200, "status");
      eq(r.body.ok, true, "ok");
      eq(r.body.renderful, true, "renderful configured");
      eq(r.body.stripe, false, "no Stripe key in this run");
      eq(r.body.stripeWebhook, true, "webhook secret configured");
      eq(r.body.licenseValidation, false, "no live licence validator");
      eq(r.body.packs, 4, "packs");
      return JSON.stringify({ renderful: r.body.renderful, stripe: r.body.stripe, packs: r.body.packs });
    })
  );

  record(
    await checkAsync("packs match the published store prices", async () => {
      const r = await api("/v1/credits/packs", { auth: false });
      eq(r.status, 200, "status");
      eq(r.body.creditUsd, 0.05, "creditUsd");
      const expected = [
        ["starter", 100, 700],
        ["builder", 300, 2100],
        ["production", 1000, 6500],
        ["agency", 3000, 18900]
      ];
      eq(r.body.packs.length, expected.length, "pack count");
      for (const [id, credits, priceCents] of expected) {
        const pack = r.body.packs.find((p) => p.id === id);
        assert(pack, `missing pack ${id}`);
        eq(pack.credits, credits, `${id} credits`);
        eq(pack.priceCents, priceCents, `${id} priceCents`);
      }
      return "4 packs · 100/$7 · 300/$21 · 1000/$65 · 3000/$189";
    })
  );

  record(
    await checkAsync("models expose live-priced credit ranges", async () => {
      const r = await api("/v1/credits/models?kind=image", { auth: false });
      eq(r.status, 200, "status");
      const flux = r.body.models.find((m) => m.id === "flux-schnell");
      assert(flux, "flux-schnell missing from catalogue");
      eq(flux.credits.min, 1, "flux credits.min");
      eq(flux.credits.max, 1, "flux credits.max");
      const seedream = r.body.models.find((m) => m.id === "seedream-4.5");
      eq(seedream.credits.min, 1, "seedream credits.min");
      eq(seedream.credits.max, 4, "seedream credits.max");
      return `${r.body.models.length} image models`;
    })
  );

  record(
    await checkAsync("unknown model and type mismatches are rejected before spending", async () => {
      const unknown = await api("/v1/credits/quote", { method: "POST", body: { type: "text-to-image", model: "definitely-not-a-model" } });
      eq(unknown.status, 400, "unknown model status");
      assert(/Unknown model/.test(unknown.body?.message ?? ""), "unknown model message");
      const wrongType = await api("/v1/credits/quote", { method: "POST", body: { type: "text-to-video", model: "flux-schnell" } });
      eq(wrongType.status, 400, "wrong type status");
      assert(/does not support type/.test(wrongType.body?.message ?? ""), "wrong type message");
      return "400 for unknown id and wrong type";
    })
  );

  /* ------------------------------------------------------- 2. quote + gate */
  console.log("\nQuote & gate");
  let quote;
  record(
    await checkAsync("quote returns a min–max range and reserves the max", async () => {
      const r = await api("/v1/credits/quote", { method: "POST", body: { type: "text-to-image", model: "flux-schnell" } });
      eq(r.status, 200, "status");
      quote = r.body.quote;
      eq(quote.usd.min, 0.003, "usd.min");
      eq(quote.usd.max, 0.012, "usd.max");
      eq(quote.credits.min, 1, "credits.min");
      eq(quote.credits.max, 1, "credits.max");
      eq(quote.credits.reserved, 1, "credits.reserved");
      eq(r.body.affordable, false, "affordable at zero balance");
      eq(r.body.shortfall, 1, "shortfall");
      eq(r.body.balance, 0, "balance");
      return "$0.003–0.012 → 1 credit (reserve max)";
    })
  );

  record(
    await checkAsync("empty balance is blocked with 402 and no reservation", async () => {
      const r = await api("/v1/credits/generations", {
        method: "POST",
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa image" }
      });
      eq(r.status, 402, "status");
      eq(r.body.error, "payment_required", "error code");
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 0, "balance unchanged");
      const hist = await api("/v1/credits/history");
      eq(hist.body.entries.length, 0, "no ledger entries");
      return "402 payment_required · balance 0 · empty ledger";
    })
  );

  record(
    await checkAsync("requests without a licence key are rejected", async () => {
      const r = await api("/v1/credits/balance", { auth: false });
      eq(r.status, 401, "status");
      return "401";
    })
  );

  /* --------------------------------------------------------- 3. admin grant */
  console.log("\nLedger & admin");
  let accountId;
  record(
    await checkAsync("admin grant requires the admin secret", async () => {
      const account = await api("/v1/credits/balance");
      accountId = account.body.accountId;
      const noSecret = await fetch(`${base}/v1/admin/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, credits: 10 })
      });
      eq(noSecret.status, 401, "missing secret status");
      const wrong = await fetch(`${base}/v1/admin/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": "nope" },
        body: JSON.stringify({ accountId, credits: 10 })
      });
      eq(wrong.status, 401, "wrong secret status");
      return accountId;
    })
  );

  record(
    await checkAsync("grant is idempotent and lands in the ledger", async () => {
      const grant = () =>
        fetch(`${base}/v1/admin/grant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
          body: JSON.stringify({ accountId, credits: 10, idempotencyKey: "qa-grant-1", note: "QA grant" })
        }).then(async (r) => ({ status: r.status, body: await r.json() }));
      const first = await grant();
      eq(first.status, 200, "first status");
      eq(first.body.balance, 10, "first balance");
      eq(first.body.replayed, false, "first replayed");
      const second = await grant();
      eq(second.body.balance, 10, "replay balance");
      eq(second.body.replayed, true, "replay flag");
      return "10 credits · replay is a no-op";
    })
  );

  /* -------------------------------------------- 4. reserve → settle → file */
  console.log("\nReserve → generate → settle");
  let imageJob;
  record(
    await checkAsync("generation reserves the max before calling upstream", async () => {
      const r = await api("/v1/credits/generations", {
        method: "POST",
        headers: { "Idempotency-Key": "qa-job-image-1" },
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa ledger image", num_outputs: 1 }
      });
      eq(r.status, 202, "status");
      imageJob = r.body.job;
      eq(imageJob.status, "queued", "job status");
      eq(imageJob.credits.reserved, 1, "reserved");
      eq(imageJob.credits.charged, null, "charged before settle");
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 9, "balance after reserve");
      const hist = await api("/v1/credits/history");
      eq(hist.body.entries[0].op, "reserve", "latest ledger op");
      return `job ${imageJob.id} · reserved 1 · balance 9`;
    })
  );

  record(
    await checkAsync("same Idempotency-Key replays without a second reservation", async () => {
      const r = await api("/v1/credits/generations", {
        method: "POST",
        headers: { "Idempotency-Key": "qa-job-image-1" },
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa ledger image", num_outputs: 1 }
      });
      eq(r.status, 200, "replay status");
      eq(r.body.job.id, imageJob.id, "same job id");
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 9, "balance unchanged");
      return `${r.body.job.id} replayed · balance 9`;
    })
  );

  let imageCompleted;
  record(
    await checkAsync("polling stores the output and signs a URL", async () => {
      const first = await api(`/v1/credits/generations/${imageJob.id}`);
      eq(first.body.job.status, "processing", "first poll status");
      const second = await api(`/v1/credits/generations/${imageJob.id}`);
      imageCompleted = second.body.job;
      eq(imageCompleted.status, "completed", "second poll status");
      eq(imageCompleted.credits.charged, 1, "charged");
      eq(imageCompleted.outputs.length, 1, "output count");
      assert(/\/files\//.test(imageCompleted.outputs[0].url ?? ""), "signed URL present");
      assert(/\?exp=\d+&sig=/.test(imageCompleted.outputs[0].url ?? ""), "exp + sig params");
      eq(imageCompleted.outputs[0].contentType, "image/png", "content type");
      eq(imageCompleted.outputs[0].bytes, PNG.length, "bytes");
      return `charged 1 · ${imageCompleted.outputs[0].bytes} bytes · expiring URL`;
    })
  );

  record(
    await checkAsync("settle matches the actual cost (no refund when equal)", async () => {
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 9, "balance");
      const hist = await api("/v1/credits/history");
      const ops = hist.body.entries.map((e) => e.op);
      assert(!ops.includes("refund"), "unexpected refund");
      return "reserved 1 · charged 1 · balance 9";
    })
  );

  record(
    await checkAsync("audio reserves max, settles actual and refunds the difference", async () => {
      const q = await api("/v1/credits/quote", { method: "POST", body: { type: "text-to-audio", model: "eleven_flash_v2" } });
      eq(q.body.quote.credits.max, 4, "quote max");
      const created = await api("/v1/credits/generations", {
        method: "POST",
        body: { type: "text-to-audio", model: "eleven_flash_v2", prompt: "qa voiceover" }
      });
      eq(created.status, 202, "create status");
      const id = created.body.job.id;
      let bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 5, "balance after 4-credit reserve");
      await api(`/v1/credits/generations/${id}`);
      const done = await api(`/v1/credits/generations/${id}`);
      eq(done.body.job.status, "completed", "status");
      eq(done.body.job.credits.reserved, 4, "reserved");
      eq(done.body.job.credits.charged, 1, "charged actual");
      bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 8, "balance after 3-credit refund");
      const hist = await api("/v1/credits/history");
      const refund = hist.body.entries.find((e) => e.op === "refund" && e.job_id === id);
      assert(refund, "refund entry missing");
      eq(refund.credits, 3, "refund credits");
      eq(refund.note, "quote reconciliation", "refund note");
      return "reserved 4 · actual $0.05 → 1 credit · refunded 3";
    })
  );

  record(
    await checkAsync("actual cost above the quote settles the overage", async () => {
      const created = await api("/v1/credits/generations", {
        method: "POST",
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa overage image" }
      });
      const id = created.body.job.id;
      let bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 7, "after reserve");
      await api(`/v1/credits/generations/${id}`);
      const done = await api(`/v1/credits/generations/${id}`);
      eq(done.body.job.credits.reserved, 1, "reserved");
      eq(done.body.job.credits.charged, 2, "charged with overage");
      eq(done.body.job.providerCostUsd, 0.06, "provider cost");
      bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 6, "balance after extra settle");
      return "reserved 1 · actual $0.06 → 2 credits · extra 1";
    })
  );

  record(
    await checkAsync("upstream failure refunds the full reservation", async () => {
      const created = await api("/v1/credits/generations", {
        method: "POST",
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa fail image" }
      });
      const id = created.body.job.id;
      let bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 5, "after reserve");
      const done = await api(`/v1/credits/generations/${id}`);
      eq(done.body.job.status, "failed", "status");
      eq(done.body.job.credits.charged, 0, "charged");
      assert(/upstream rejected/.test(done.body.job.error ?? ""), "error surfaced");
      bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 6, "balance refunded");
      return "failed → reserved credit returned";
    })
  );

  record(
    await checkAsync("output download failure refunds the full reservation", async () => {
      const created = await api("/v1/credits/generations", {
        method: "POST",
        body: { type: "text-to-image", model: "flux-schnell", prompt: "qa baddownload image" }
      });
      const id = created.body.job.id;
      const first = await api(`/v1/credits/generations/${id}`);
      eq(first.body.job.status, "processing", "first poll status");
      const done = await api(`/v1/credits/generations/${id}`);
      eq(done.body.job.status, "failed", "status");
      assert(/Output download failed/.test(done.body.job.error ?? ""), "download error surfaced");
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 6, "balance refunded");
      return "404 on output → credits returned";
    })
  );

  /* ------------------------------------------------------- 5. file serving */
  console.log("\nSigned output delivery");
  const fileUrl = imageCompleted.outputs[0].url;
  record(
    await checkAsync("signed URL serves the file with Range support", async () => {
      const full = await fetch(fileUrl);
      eq(full.status, 200, "full status");
      eq(full.headers.get("content-type"), "image/png", "content-type");
      eq(full.headers.get("accept-ranges"), "bytes", "accept-ranges");
      eq(Number(full.headers.get("content-length")), PNG.length, "content-length");
      const bytes = Buffer.from(await full.arrayBuffer());
      eq(bytes.length, PNG.length, "body length");
      const head = await fetch(fileUrl, { method: "HEAD" });
      eq(head.status, 200, "HEAD status");
      const ranged = await fetch(fileUrl, { headers: { Range: "bytes=0-99" } });
      eq(ranged.status, 206, "range status");
      eq(ranged.headers.get("content-range"), `bytes 0-99/${PNG.length}`, "content-range");
      const slice = Buffer.from(await ranged.arrayBuffer());
      eq(slice.length, 100, "range length");
      return `200 · HEAD 200 · Range 206 (100/${PNG.length} bytes)`;
    })
  );

  record(
    await checkAsync("tampered and expired signatures are refused", async () => {
      const tampered = await fetch(fileUrl.replace(/sig=[^&]+/, "sig=deadbeef"));
      eq(tampered.status, 403, "tampered status");
      clockOffsetMs = 2 * 3600 * 1000;
      const expired = await fetch(fileUrl);
      eq(expired.status, 403, "expired status");
      const body = await expired.json();
      assert(/expired/i.test(body?.message ?? ""), "expired reason");
      clockOffsetMs = 0;
      const refreshed = await api(`/v1/credits/generations/${imageJob.id}`);
      const again = await fetch(refreshed.body.job.outputs[0].url);
      eq(again.status, 200, "re-read job issues a fresh working URL");
      return "tampered 403 · expired 403 · job re-read re-signs";
    })
  );

  record(
    await checkAsync("path traversal via a signed path cannot escape the data dir", async () => {
      const rel = "../../credits.sqlite";
      const exp = Math.floor(Date.now() / 1000) + 300;
      const sig = crypto.createHmac("sha256", signingSecret).update(`${rel}\n${exp}`).digest("base64url");
      const res = await fetch(`${base}/files/..%2F..%2Fcredits.sqlite?exp=${exp}&sig=${sig}`);
      assert([403, 404].includes(res.status), `unexpected ${res.status}`);
      return `blocked with ${res.status}`;
    })
  );

  /* ------------------------------------------------------ 6. Stripe webhook */
  console.log("\nStripe webhook (locally signed, no Stripe calls)");
  const checkout = await api("/v1/credits/checkout", { method: "POST", body: { packId: "starter" } });
  if (checkout.status !== 200 || !checkout.body.intentId) {
    console.log(`  \u2716 checkout intent could not be created — ${checkout.status} ${checkout.text.slice(0, 200)}`);
    failed += 1;
  } else {
    const intentId = checkout.body.intentId;
    record(
      await checkAsync("checkout without Stripe falls back to the store operator", async () => {
        eq(checkout.body.provider, "external", "provider");
        eq(checkout.body.creditedAutomatically, false, "creditedAutomatically");
        eq(checkout.body.url, "https://skills.animotion.click/credits", "fallback url");
        return `${intentId} → external`;
      })
    );

    record(
      await checkAsync("paid checkout grants the pack exactly once", async () => {
        const evt = eventFor({ id: "evt_qa_paid_1", intentId, amount: 700 });
        const r = await deliverEvent(evt, webhookSecret);
        eq(r.status, 200, "status");
        eq(r.body.granted, 100, "granted");
        eq(r.body.balance, 106, "balance");
        return "event accepted · +100 credits";
      })
    );

    record(
      await checkAsync("replayed event id is deduplicated", async () => {
        const evt = eventFor({ id: "evt_qa_paid_1", intentId, amount: 700 });
        const r = await deliverEvent(evt, webhookSecret);
        eq(r.body.duplicate, true, "duplicate");
        eq(r.body.granted, 0, "granted");
        const bal = await api("/v1/credits/balance");
        eq(bal.body.balance, 106, "balance");
        return "duplicate:true · balance 106";
      })
    );

    record(
      await checkAsync("a second event for a paid intent cannot double-credit", async () => {
        const evt = eventFor({ id: "evt_qa_paid_2", intentId, amount: 700 });
        const r = await deliverEvent(evt, webhookSecret);
        eq(r.body.alreadyCredited, true, "alreadyCredited");
        eq(r.body.granted, 0, "granted");
        const bal = await api("/v1/credits/balance");
        eq(bal.body.balance, 106, "balance");
        return "alreadyCredited:true · balance 106";
      })
    );

    record(
      await checkAsync("client_reference_id works when metadata is absent", async () => {
        const c = await api("/v1/credits/checkout", { method: "POST", body: { packId: "builder" } });
        const evt = eventFor({ id: "evt_qa_ref_1", intentId: c.body.intentId, amount: 2100, metadata: false });
        const r = await deliverEvent(evt, webhookSecret);
        eq(r.body.granted, 300, "granted");
        const bal = await api("/v1/credits/balance");
        eq(bal.body.balance, 406, "balance");
        return "+300 via client_reference_id";
      })
    );

    record(
      await checkAsync("bad signature, stale timestamp and rewritten body are refused", async () => {
        const evt = eventFor({ id: "evt_qa_badsig", intentId, amount: 700 });
        const raw = JSON.stringify(evt);
        const bad = await fetch(`${base}/v1/stripe/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "stripe-signature": stripeSign(raw, "whsec_wrong") },
          body: raw
        });
        eq(bad.status, 400, "bad signature status");
        const stale = await fetch(`${base}/v1/stripe/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": stripeSign(raw, webhookSecret, Math.floor(Date.now() / 1000) - 3600)
          },
          body: raw
        });
        eq(stale.status, 400, "stale status");
        const rewritten = await fetch(`${base}/v1/stripe/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "stripe-signature": stripeSign(raw, webhookSecret) },
          body: raw.replace("700", "701")
        });
        eq(rewritten.status, 400, "rewritten body status");
        return "400 on wrong key, stale t, and body tamper";
      })
    );

    record(
      await checkAsync("amount mismatches, unpaid sessions and unknown intents grant nothing", async () => {
        const mismatch = await api("/v1/credits/checkout", { method: "POST", body: { packId: "starter" } });
        const m = await deliverEvent(eventFor({ id: "evt_qa_mismatch", intentId: mismatch.body.intentId, amount: 699 }), webhookSecret);
        eq(m.body.ignored, "amount_mismatch", "amount mismatch");
        const unpaid = await api("/v1/credits/checkout", { method: "POST", body: { packId: "starter" } });
        const u = await deliverEvent(
          eventFor({ id: "evt_qa_unpaid", intentId: unpaid.body.intentId, amount: 700, paymentStatus: "unpaid" }),
          webhookSecret
        );
        eq(u.body.pending, true, "unpaid pending");
        const missing = await deliverEvent(
          { id: "evt_qa_missing", object: "event", type: "checkout.session.completed", data: { object: { amount_total: 700, metadata: {} } } },
          webhookSecret
        );
        eq(missing.body.ignored, "missing_intent", "missing intent");
        const unknown = await deliverEvent(eventFor({ id: "evt_qa_unknown", intentId: "ci_does_not_exist", amount: 700 }), webhookSecret);
        eq(unknown.body.ignored, "unknown_intent", "unknown intent");
        const bal = await api("/v1/credits/balance");
        eq(bal.body.balance, 406, "balance unchanged");
        return "amount_mismatch · pending · missing_intent · unknown_intent";
      })
    );

    record(
      await checkAsync("unrelated events are recorded and ignored", async () => {
        const evt = { id: "evt_qa_other", object: "event", type: "customer.created", data: { object: { id: "cus_qa" } } };
        const r = await deliverEvent(evt, webhookSecret);
        eq(r.body.ignored, "customer.created", "ignored type");
        return "customer.created ignored";
      })
    );
  }

  /* --------------------------------------------------------- 7. ledger view */
  console.log("\nLedger view");
  record(
    await checkAsync("history is newest-first and reconciles to the balance", async () => {
      const hist = await api("/v1/credits/history?limit=100");
      eq(hist.status, 200, "status");
      const entries = hist.body.entries;
      assert(entries.length >= 10, `expected a populated ledger, got ${entries.length}`);
      const ops = new Set(entries.map((e) => e.op));
      for (const op of ["admin", "reserve", "refund", "settle", "purchase"]) {
        assert(ops.has(op), `ledger missing op ${op}`);
      }
      const times = entries.map((e) => Date.parse(e.created_at));
      for (let i = 1; i < times.length; i += 1) {
        assert(times[i - 1] >= times[i], "history is not newest-first");
      }
      // Ledger amounts are signed: debits (reserve/settle) are negative.
      const sum = entries.reduce((acc, e) => acc + Number(e.credits), 0);
      const bal = await api("/v1/credits/balance");
      if (sum !== bal.body.balance) {
        const byOp = entries.reduce((acc, e) => {
          acc[e.op] = acc[e.op] ?? { n: 0, credits: 0 };
          acc[e.op].n += 1;
          acc[e.op].credits += e.credits;
          return acc;
        }, {});
        throw new Error(`ledger sum ${sum} != balance ${bal.body.balance} (${JSON.stringify(byOp)})`);
      }
      return `${entries.length} entries · sum ${sum} = balance ${bal.body.balance}`;
    })
  );

  record(
    await checkAsync("accounts are isolated per licence key", async () => {
      const other = await fetch(`${base}/v1/credits/balance`, { headers: { "x-license-key": "qa-license-other-key-0002" } });
      const body = await other.json();
      eq(body.balance, 0, "other account balance");
      assert(body.accountId !== accountId, "account ids must differ");
      const hist = await fetch(`${base}/v1/credits/history`, { headers: { "x-license-key": "qa-license-other-key-0002" } });
      const hb = await hist.json();
      eq(hb.entries.length, 0, "other account history");
      return "second key sees an empty, separate ledger";
    })
  );

  /* ------------------------------------------------------- 8. bad requests */
  console.log("\nInput validation");
  record(
    await checkAsync("invalid generation inputs are rejected", async () => {
      const cases = [
        [{ type: "text-to-image", model: "flux-schnell" }, "prompt required"],
        [{ type: "image-to-image", model: "flux-dev" }, "image_url required"],
        [{ type: "text-to-image", model: "flux-schnell", prompt: "x", num_outputs: 11 }, "num_outputs range"],
        [{ model: "flux-schnell", prompt: "x" }, "type required"]
      ];
      for (const [body, label] of cases) {
        const r = await api("/v1/credits/generations", { method: "POST", body });
        eq(r.status, 400, label);
      }
      const bal = await api("/v1/credits/balance");
      eq(bal.body.balance, 406, "balance untouched by rejections");
      return `${cases.length} rejected · balance untouched`;
    })
  );

  record(
    await checkAsync("one account cannot read another account's job", async () => {
      const r = await fetch(`${base}/v1/credits/generations/${imageJob.id}`, {
        headers: { "x-license-key": "qa-license-other-key-0002" }
      });
      eq(r.status, 404, "status");
      return "404";
    })
  );

  record(
    await checkAsync("two concurrent jobs cannot overdraw one account", async () => {
      const key = "qa-license-concurrency-key-0003";
      const acct = await fetch(`${base}/v1/credits/balance`, { headers: { "x-license-key": key } }).then((r) => r.json());
      const grant = await fetch(`${base}/v1/admin/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ accountId: acct.accountId, credits: 5, idempotencyKey: "qa-concurrency-grant" })
      }).then((r) => r.json());
      eq(grant.balance, 5, "seed balance");
      const body = { type: "text-to-audio", model: "eleven_flash_v2", prompt: "qa concurrent" };
      const fire = () =>
        fetch(`${base}/v1/credits/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-license-key": key },
          body: JSON.stringify(body)
        });
      const [a, b] = await Promise.all([fire(), fire()]);
      const statuses = [a.status, b.status].sort().join(",");
      eq(statuses, "202,402", "one accepted, one refused");
      const bal = await fetch(`${base}/v1/credits/balance`, { headers: { "x-license-key": key } }).then((r) => r.json());
      eq(bal.balance, 1, "balance after one 4-credit reserve");
      return "202 + 402 · balance 1 · never negative";
    })
  );

  /* ------------------------------------------------------------- teardown */
  await app.close();
  await new Promise((resolve) => fake.server.close(resolve));

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"}  ${passed} passed, ${failed} failed`);
  if (!KEEP) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* Windows file locks are harmless here */
    }
  } else {
    console.log(`  data kept at ${tmpDir}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(`\nFATAL ${e.stack ?? e.message}`);
  try {
    await app?.close();
  } catch {
    /* already closed */
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
