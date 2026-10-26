import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../src/server.mjs";
import { createDb } from "../src/db.mjs";
import { createSignedUrls } from "../src/signed-url.mjs";
import { catalogFetch, fluxDev, silentLog, testConfig } from "./helpers.mjs";

async function start() {
  const { config, dir, cleanup } = testConfig();
  const db = createDb(config.dbPath);
  const app = createApp({ config, log: silentLog, db, fetchImpl: catalogFetch([fluxDev]) });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    config,
    db,
    app,
    base,
    cleanup: async () => {
      await app.close();
      db.close();
      cleanup();
    }
  };
}

const LICENSE = { "x-license-key": "test-license-12345678" };

test("HTTP smoke test: health, packs, models", async () => {
  const { app, base, cleanup } = await start();
  try {
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.renderful, true);
    assert.equal(health.stripe, false);
    assert.equal(health.licenseValidation, false);
    assert.equal(health.packs, 4);

    const packs = await (await fetch(`${base}/v1/credits/packs`)).json();
    assert.equal(packs.packs.length, 4);
    assert.equal(packs.creditUsd, 0.05);
    assert.equal(packs.packs.find((p) => p.id === "starter").price, "$7.00");

    const models = await (await fetch(`${base}/v1/credits/models?kind=image`)).json();
    assert.equal(models.models.length, 1);
    assert.equal(models.models[0].id, "flux-dev");
    assert.deepEqual(models.models[0].credits, { min: 1, max: 2 });
  } finally {
    await cleanup();
  }
});

test("balance requires a license and creates the account on first use", async () => {
  const { base, cleanup } = await start();
  try {
    const unauthorized = await fetch(`${base}/v1/credits/balance`);
    assert.equal(unauthorized.status, 401);

    const res = await fetch(`${base}/v1/credits/balance`, { headers: LICENSE });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.balance, 0);
    assert.match(body.accountId, /^acct_[a-f0-9]{32}$/);
  } finally {
    await cleanup();
  }
});

test("admin grant tops up an account and is visible in balance", async () => {
  const { base, cleanup } = await start();
  try {
    const who = await (await fetch(`${base}/v1/credits/balance`, { headers: LICENSE })).json();

    const denied = await fetch(`${base}/v1/admin/grant`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": "wrong" },
      body: JSON.stringify({ accountId: who.accountId, credits: 50 })
    });
    assert.equal(denied.status, 401);

    const granted = await fetch(`${base}/v1/admin/grant`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": "admin-secret" },
      body: JSON.stringify({ accountId: who.accountId, credits: 50, note: "test" })
    });
    assert.equal(granted.status, 200);
    assert.equal((await granted.json()).balance, 50);

    const after = await (await fetch(`${base}/v1/credits/balance`, { headers: LICENSE })).json();
    assert.equal(after.balance, 50);

    const history = await (await fetch(`${base}/v1/credits/history`, { headers: LICENSE })).json();
    assert.equal(history.entries.length, 1);
    assert.equal(history.entries[0].op, "admin");
  } finally {
    await cleanup();
  }
});

test("quote and generation endpoints reject malformed bodies and unknown routes", async () => {
  const { base, cleanup } = await start();
  try {
    const badJson = await fetch(`${base}/v1/credits/quote`, {
      method: "POST",
      headers: { ...LICENSE, "content-type": "application/json" },
      body: "{not json"
    });
    assert.equal(badJson.status, 400);

    const missing = await fetch(`${base}/v1/nope`);
    assert.equal(missing.status, 404);

    const noModel = await fetch(`${base}/v1/credits/quote`, {
      method: "POST",
      headers: { ...LICENSE, "content-type": "application/json" },
      body: JSON.stringify({ type: "text-to-image" })
    });
    assert.equal(noModel.status, 400);
  } finally {
    await cleanup();
  }
});

test("webhook is refused when Stripe is not configured", async () => {
  const { base, cleanup } = await start();
  try {
    const res = await fetch(`${base}/v1/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=x" },
      body: "{}"
    });
    assert.equal(res.status, 503);
  } finally {
    await cleanup();
  }
});

test("signed files are served with range support and reject tampering", async () => {
  const { config, base, cleanup } = await start();
  try {
    const rel = "acct_x/job_y/1.txt";
    const abs = path.join(config.filesDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "hello-world");

    const signer = createSignedUrls({ config });
    const signed = new URL(signer.sign(rel));

    const full = await fetch(`${base}${signed.pathname}${signed.search}`);
    assert.equal(full.status, 200);
    assert.match(full.headers.get("content-type"), /text\/plain/);
    assert.equal(await full.text(), "hello-world");

    const partial = await fetch(`${base}${signed.pathname}${signed.search}`, {
      headers: { Range: "bytes=0-4" }
    });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-4/11");
    assert.equal(await partial.text(), "hello");

    const tampered = await fetch(`${base}/files/acct_x/job_y/2.txt${signed.search}`);
    assert.equal(tampered.status, 403);
  } finally {
    await cleanup();
  }
});

test("CORS headers are emitted when ALLOW_ORIGIN is set", async () => {
  const { config, dir, cleanup } = testConfig({ ALLOW_ORIGIN: "https://app.test" });
  const db = createDb(config.dbPath);
  const app = createApp({ config, log: silentLog, db, fetchImpl: catalogFetch([fluxDev]) });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const preflight = await fetch(`${base}/v1/credits/balance`, {
      method: "OPTIONS",
      headers: { Origin: "https://app.test", "Access-Control-Request-Method": "GET" }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://app.test");
    assert.match(preflight.headers.get("access-control-allow-headers"), /X-License-Key/);
  } finally {
    await app.close();
    db.close();
    cleanup();
  }
});
