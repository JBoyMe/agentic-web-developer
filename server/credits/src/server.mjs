import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";
import { createLogger, redact } from "./log.mjs";
import { createDb } from "./db.mjs";
import { createPricing } from "./pricing.mjs";
import { createRenderful } from "./renderful.mjs";
import { createStorage } from "./storage.mjs";
import { createSignedUrls } from "./signed-url.mjs";
import { createStripe } from "./stripe.mjs";
import { createAuth } from "./auth.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import { createService } from "./service.mjs";
import { HttpError, badRequest, notFound, unauthorized } from "./errors.mjs";

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  json: "application/json",
  txt: "text/plain; charset=utf-8"
};

const mimeFor = (file) => MIME[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";

function clientIp(req, config) {
  if (config.trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function licenseFrom(req) {
  const direct = req.headers["x-license-key"];
  if (direct) return String(Array.isArray(direct) ? direct[0] : direct).trim();
  const auth = String(req.headers.authorization ?? "");
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return "";
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "payload_too_large", `Request body exceeds ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, maxBytes) {
  const raw = await readBody(req, maxBytes);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}

const STORE_URL = "https://skills.animotion.click";

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

/**
 * Post-checkout landing page. Stripe redirects the buyer here, so it has to be
 * a real page: without it every successful payment ends on a 404, which is both
 * alarming and the moment the buyer is deciding whether the credits arrived.
 */
function checkoutPage({ cancelled = false, sessionId = "", status = null }) {
  const money = (cents) => `$${(Number(cents) / 100).toFixed(2).replace(/\.00$/, "")}`;
  let heading = "Checkout cancelled";
  let body = "Nothing was charged. Your balance is unchanged.";
  let detail = "";
  let refresh = "";
  let tone = "warn";

  if (!cancelled) {
    tone = "ok";
    heading = "Payment received";
    if (status) {
      detail = `${escapeHtml(status.packName)} · ${status.credits.toLocaleString("en-US")} credits · ${money(
        status.priceCents
      )}`;
      body =
        status.status === "paid"
          ? "Your credits are in the balance now — you can close this tab and go back to your session."
          : "Stripe has taken the payment; the webhook is applying your credits now. This page refreshes itself.";
      if (status.status !== "paid") refresh = '<meta http-equiv="refresh" content="3">';
    } else {
      body =
        "Payment received. If the credits are not in your balance within a minute, send this session id to support.";
      detail = sessionId ? `Session ${escapeHtml(sessionId)}` : "";
    }
  } else if (sessionId) {
    detail = `Session ${escapeHtml(sessionId)}`;
  }

  const accent = tone === "ok" ? "#a8e05f" : "#e0b95f";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${refresh}
<title>${escapeHtml(heading)} · Asset credits</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: #0d0d11; color: #ececf3;
    font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { width: 100%; max-width: 430px; text-align: center; }
  .mark { width: 52px; height: 52px; margin: 0 auto 20px; border-radius: 14px;
          border: 1px solid ${accent}55; background: ${accent}14; display: grid; place-items: center; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: ${accent}; }
  h1 { font-size: 24px; line-height: 1.25; margin: 0 0 10px; letter-spacing: -0.02em; }
  p { margin: 0 0 14px; color: #b9b9c6; }
  .detail { display: inline-block; margin: 4px 0 18px; padding: 7px 13px; border-radius: 999px;
            background: #ffffff0a; border: 1px solid #ffffff14; color: #d8d8e4; font-size: 13px; }
  a { color: ${accent}; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  .fine { margin-top: 22px; font-size: 12px; color: #6f6f80; }
</style>
</head>
<body>
<main>
  <div class="mark"><div class="dot"></div></div>
  <h1>${escapeHtml(heading)}</h1>
  <p>${body}</p>
  ${detail ? `<div class="detail">${detail}</div><br>` : ""}
  <a href="${STORE_URL}">Back to Animotion</a>
  <div class="fine">Asset credits are prepaid and separate from your Pro, Studio or Template plan.</div>
</main>
</body>
</html>`;
}

export function createApp(overrides = {}) {
  const config = overrides.config ?? loadConfig();
  const log = overrides.log ?? createLogger(config.logLevel);
  const now = overrides.now ?? (() => Date.now());

  const ownsDb = !overrides.db;
  const db = overrides.db ?? createDb(config.dbPath);
  const pricing = overrides.pricing ?? createPricing({ config, log, fetchImpl: overrides.fetchImpl });
  const renderful = overrides.renderful ?? createRenderful({ config, log, fetchImpl: overrides.fetchImpl });
  const storage = overrides.storage ?? createStorage({ config, log });
  const signedUrls =
    overrides.signedUrls ?? createSignedUrls({ config, now: overrides.signedNow ?? now });
  const stripe = overrides.stripe ?? createStripe({ config, log, fetchImpl: overrides.fetchImpl });
  const auth = overrides.auth ?? createAuth({ config, db, log, fetchImpl: overrides.fetchImpl, now });
  const service =
    overrides.service ??
    createService({ config, db, pricing, renderful, storage, signedUrls, stripe, log, now });

  const limiter = createRateLimiter({ perMinute: config.rateLimit.perMinute, now });
  const limiterSweep = setInterval(() => limiter.sweep(), 5 * 60 * 1000);
  limiterSweep.unref?.();

  function cors(req, res) {
    if (config.allowOrigin) {
      const origin = req.headers.origin;
      const allow = config.allowOrigin === "*" ? "*" : origin && origin === config.allowOrigin ? origin : config.allowOrigin;
      res.setHeader("Access-Control-Allow-Origin", allow);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-License-Key, Idempotency-Key, Stripe-Signature, X-Admin-Secret"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
    }
  }

  function sendJson(res, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload),
      "Cache-Control": "no-store",
      ...extraHeaders
    });
    res.end(payload);
  }

  function sendHtml(res, status, html) {
    res.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(html),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
    });
    res.end(html);
  }

  function sendError(res, err) {
    const status = err instanceof HttpError ? err.status : 500;
    const body = {
      error: err instanceof HttpError ? err.code : "internal_error",
      message: status === 500 ? "Internal server error" : String(err?.message ?? "Request failed")
    };
    if (err instanceof HttpError && err.details) body.details = err.details;
    if (status === 500) log?.error("unhandled request error", { error: redact(err?.stack ?? err?.message ?? err) });
    sendJson(res, status, body);
  }

  function enforceRate(req, res, key) {
    if (!config.rateLimit.enabled) return true;
    const result = limiter.check(key);
    if (!result.ok) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
      sendJson(res, 429, {
        error: "rate_limited",
        message: `Rate limit exceeded (${config.rateLimit.perMinute}/minute)`
      });
      return false;
    }
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    return true;
  }

  async function serveFile(req, res, url) {
    const parts = url.pathname.split("/").filter(Boolean).slice(1);
    let relPath;
    try {
      relPath = parts.map((p) => decodeURIComponent(p)).join("/");
    } catch {
      throw notFound("File not found");
    }

    const check = signedUrls.verify(relPath, url.searchParams.get("exp"), url.searchParams.get("sig"));
    if (!check.ok) {
      throw new HttpError(403, "invalid_signature", `File link is not valid (${check.reason})`);
    }

    const abs = storage.resolve(relPath);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      throw notFound("File not found");
    }
    if (!stat.isFile()) throw notFound("File not found");

    const mime = mimeFor(abs);
    const headers = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${path.basename(abs).replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff"
    };

    const range = String(req.headers.range ?? "");
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      let start = match[1] ? Number(match[1]) : null;
      let end = match[2] ? Number(match[2]) : null;
      if (start === null) {
        start = Math.max(0, stat.size - (end ?? 0));
        end = stat.size - 1;
      } else if (end === null || end >= stat.size) {
        end = stat.size - 1;
      }
      if (start > end || start >= stat.size) {
        res.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      headers["Content-Length"] = String(end - start + 1);
      res.writeHead(206, headers);
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(abs, { start, end }).pipe(res);
      return;
    }

    headers["Content-Length"] = String(stat.size);
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(abs).pipe(res);
  }

  async function handler(req, res) {
    cors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const { pathname } = url;
    const method = req.method ?? "GET";
    const ipKey = `ip:${clientIp(req, config)}`;

    try {
      if (method === "GET" && pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "awd-credits-proxy",
          version: "1.0.0",
          time: new Date(now()).toISOString(),
          renderful: Boolean(config.renderful.apiKey),
          stripe: Boolean(config.stripe.secretKey),
          stripeWebhook: Boolean(config.stripe.webhookSecret),
          licenseValidation: Boolean(config.license.validateUrl),
          checkout: Boolean(config.stripe.secretKey) || Boolean(config.checkoutFallbackUrl),
          packs: config.packs.length
        });
      }

      // Stripe redirects the buyer here after payment. Public on purpose: the
      // session id is the only thing in the URL and it reveals no account data.
      if (method === "GET" && (pathname === "/checkout/success" || pathname === "/checkout/cancel")) {
        const cancelled = pathname === "/checkout/cancel";
        const sessionId = url.searchParams.get("session_id") ?? "";
        let status = null;
        if (!cancelled && sessionId) {
          try {
            status = service.checkoutStatus(sessionId);
          } catch {
            status = null;
          }
        }
        return sendHtml(res, 200, checkoutPage({ cancelled, sessionId, status }));
      }

      if (method === "GET" && pathname === "/v1/credits/packs") {
        if (!enforceRate(req, res, ipKey)) return;
        return sendJson(res, 200, { packs: service.packs(), creditUsd: config.pricing.creditUsd });
      }

      if (method === "GET" && pathname === "/v1/credits/models") {
        if (!enforceRate(req, res, ipKey)) return;
        const models = await service.models({
          type: url.searchParams.get("type") ?? undefined,
          kind: url.searchParams.get("kind") ?? undefined,
          q: url.searchParams.get("q") ?? undefined,
          limit: url.searchParams.get("limit") ?? 200
        });
        return sendJson(res, 200, { models, creditUsd: config.pricing.creditUsd });
      }

      if (method === "POST" && pathname === "/v1/stripe/webhook") {
        if (!config.stripe.webhookSecret) {
          throw new HttpError(503, "unavailable", "Stripe webhooks are not configured");
        }
        const raw = await readBody(req, config.maxBodyBytes);
        const event = stripe.verifyWebhook(raw.toString("utf8"), req.headers["stripe-signature"]);
        const result = await service.handleStripeEvent(event);
        return sendJson(res, 200, { received: true, ...result });
      }

      if ((method === "GET" || method === "HEAD") && pathname.startsWith("/files/")) {
        return await serveFile(req, res, url);
      }

      if (method === "POST" && pathname === "/v1/admin/grant") {
        if (!auth.isAdmin(req.headers["x-admin-secret"])) {
          throw unauthorized("Admin credentials required");
        }
        if (!enforceRate(req, res, ipKey)) return;
        const body = await readJson(req, config.maxBodyBytes);
        return sendJson(res, 200, service.adminGrant(body));
      }

      // Everything below requires a license key.
      const needsLicense =
        pathname.startsWith("/v1/credits/") && pathname !== "/v1/credits/packs" && pathname !== "/v1/credits/models";
      if (!needsLicense) throw notFound("Not found");

      const key = licenseFrom(req);
      if (!key) throw unauthorized("Provide your license key in the `x-license-key` header");
      const account = await auth.authenticate(key);
      if (!enforceRate(req, res, `acct:${account.accountId}`)) return;

      if (method === "GET" && pathname === "/v1/credits/balance") {
        return sendJson(res, 200, service.balanceOf(account.accountId));
      }

      if (method === "GET" && pathname === "/v1/credits/history") {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return sendJson(res, 200, { entries: service.historyOf(account.accountId, limit) });
      }

      if (method === "POST" && pathname === "/v1/credits/quote") {
        const body = await readJson(req, config.maxBodyBytes);
        const result = await service.quote(account.accountId, body);
        return sendJson(res, 200, result);
      }

      if (pathname === "/v1/credits/generations") {
        if (method === "POST") {
          const body = await readJson(req, config.maxBodyBytes);
          const idempotencyKey = req.headers["idempotency-key"]
            ? String(req.headers["idempotency-key"]).slice(0, 200)
            : undefined;
          const result = await service.createGeneration(account.accountId, body, { idempotencyKey });
          return sendJson(res, result.replay ? 200 : 202, { ...result });
        }
        if (method === "GET") {
          const limit = Number(url.searchParams.get("limit") ?? 20);
          return sendJson(res, 200, { jobs: service.listJobs(account.accountId, limit) });
        }
      }

      const genMatch = /^\/v1\/credits\/generations\/([A-Za-z0-9_-]+)$/.exec(pathname);
      if (genMatch && method === "GET") {
        const job = await service.getJob(account.accountId, genMatch[1]);
        return sendJson(res, 200, { job });
      }

      if (method === "POST" && pathname === "/v1/credits/checkout") {
        const body = await readJson(req, config.maxBodyBytes);
        const result = await service.createCheckout(account.accountId, body.packId, {
          customerEmail: body.email
        });
        return sendJson(res, 200, result);
      }

      throw notFound("Not found");
    } catch (err) {
      if (res.headersSent) {
        log?.error("response already started; closing", { error: err?.message });
        return res.end();
      }
      return sendError(res, err);
    }
  }

  const server = http.createServer((req, res) => {
    handler(req, res).catch((err) => sendError(res, err));
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;

  async function close() {
    clearInterval(limiterSweep);
    await new Promise((resolve) => server.close(resolve));
    if (ownsDb) {
      try {
        db.close();
      } catch {
        /* already closed */
      }
    }
  }

  return { config, log, db, service, server, close };
}

export function validateConfig(config, log) {
  const problems = [];
  const warnings = [];

  if (!config.signingSecret) problems.push("FILE_SIGNING_SECRET is required (signs output URLs)");
  else if (config.signingSecret.length < 32) warnings.push("FILE_SIGNING_SECRET should be at least 32 characters");

  if (!config.publicBaseUrl) problems.push("PUBLIC_BASE_URL is required (public origin of this proxy)");
  else if (config.isProduction && !/^https:\/\//i.test(config.publicBaseUrl)) {
    warnings.push("PUBLIC_BASE_URL should use https in production");
  }

  if (!config.renderful.apiKey) {
    const message = "RENDERFUL_API_KEY is missing — generation will fail";
    config.isProduction ? problems.push(message) : warnings.push(message);
  }
  if (!config.license.validateUrl) {
    const message = "LICENSE_VALIDATE_URL is missing — every key will be treated as unverified";
    config.isProduction ? problems.push(message) : warnings.push(message);
  }
  if (config.isProduction && config.license.allowUnverified) {
    problems.push("ALLOW_UNVERIFIED_LICENSES must be false in production");
  }
  if (!config.adminSecret) warnings.push("ADMIN_SECRET is missing — /v1/admin/grant is disabled");
  if (!config.stripe.secretKey) warnings.push("STRIPE_SECRET_KEY is missing — new checkouts need CHECKOUT_FALLBACK_URL");
  if (config.stripe.secretKey && !config.stripe.webhookSecret) {
    warnings.push("STRIPE_WEBHOOK_SECRET is missing — purchases cannot be credited automatically");
  }
  if (!config.stripe.successUrl) warnings.push("STRIPE_SUCCESS_URL is missing — using the proxy origin fallback");
  if (!config.rateLimit.enabled) warnings.push("Rate limiting is disabled");

  for (const warning of warnings) log?.warn(warning);
  if (problems.length > 0) {
    const error = new Error(`Invalid configuration:\n - ${problems.join("\n - ")}`);
    error.problems = problems;
    throw error;
  }
  return { warnings };
}

export async function startServer() {
  // The documented local setup is `cp .env.example .env`; Node does not read it
  // on its own, so load it here. Real environment variables always win, and a
  // missing file is fine (Docker/hosted deploys pass env directly).
  if (typeof process.loadEnvFile === "function") {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
    try {
      process.loadEnvFile(process.env.ENV_FILE || path.join(root, ".env"));
    } catch {
      /* no .env file: rely on the process environment */
    }
  }

  const config = loadConfig();
  const log = createLogger(config.logLevel);
  validateConfig(config, log);

  const app = createApp({ config, log });
  await new Promise((resolve, reject) => {
    app.server.once("error", reject);
    app.server.listen(config.port, config.host, () => {
      app.server.removeListener("error", reject);
      resolve();
    });
  });

  const timer = setInterval(() => {
    app.service
      .pollBatch()
      .catch((e) => log.error("poll batch failed", { error: e.message }));
  }, config.jobs.pollIntervalMs);
  timer.unref?.();

  log.info("credits proxy listening", {
    url: `http://${config.host}:${config.port}`,
    publicBaseUrl: config.publicBaseUrl,
    env: config.env,
    packs: config.packs.map((p) => p.id)
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("shutting down", { signal });
    clearInterval(timer);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return { ...app, timer };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  startServer().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
