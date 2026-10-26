import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "../src/db.mjs";
import { createPricing } from "../src/pricing.mjs";
import { createStorage } from "../src/storage.mjs";
import { createSignedUrls } from "../src/signed-url.mjs";
import { createService } from "../src/service.mjs";
import { catalogFetch, fluxDev, silentLog, testConfig, wan26 } from "./helpers.mjs";

const T0 = Date.parse("2026-01-01T00:00:00Z");
const ACCOUNT = "acct_test_account";

function makeRenderful(overrides = {}) {
  const calls = { create: 0, poll: 0 };
  const base = {
    createGeneration: async () => {
      calls.create += 1;
      return { id: "gen_1", status: "queued", cost: 0.1 };
    },
    getGeneration: async () => {
      calls.poll += 1;
      return {
        id: "gen_1",
        status: "completed",
        outputs: ["https://files.test/out.png"],
        error: null,
        cost: 0.1
      };
    },
    download: async (url, dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, "png-bytes");
      return { bytes: 9, contentType: "image/png" };
    }
  };
  return { renderful: { ...base, ...overrides }, calls };
}

function setup({ startingBalance = 100, models = [fluxDev, wan26], stripe, renderful } = {}) {
  const { config, cleanup } = testConfig();
  const db = createDb(config.dbPath);
  const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch(models) });
  const fake = renderful ?? makeRenderful();
  const storage = createStorage({ config, log: silentLog });
  const signedUrls = createSignedUrls({ config, now: () => T0 });
  const stripeFake = stripe ?? {
    configured: false,
    paidEvents: new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]),
    createCheckoutSession: async () => {
      throw new Error("stripe not configured in this test");
    }
  };
  const service = createService({
    config,
    db,
    pricing,
    renderful: fake.renderful,
    storage,
    signedUrls,
    stripe: stripeFake,
    log: silentLog,
    now: () => T0
  });
  db.ensureAccount(ACCOUNT);
  if (startingBalance > 0) db.credit(ACCOUNT, startingBalance, { op: "admin" });
  return {
    config,
    db,
    service,
    renderful: fake.renderful,
    calls: fake.calls,
    cleanup: () => {
      db.close();
      cleanup();
    }
  };
}

test("quote returns affordability without spending", async () => {
  const { service, db, cleanup } = setup();
  try {
    const result = await service.quote(ACCOUNT, { type: "text-to-image", model: "flux-dev" });
    assert.equal(result.balance, 100);
    assert.equal(result.quote.credits.reserved, 2);
    assert.equal(result.affordable, true);
    assert.equal(result.packs.length, 4);
    assert.equal(db.balance(ACCOUNT), 100);
  } finally {
    cleanup();
  }
});

test("create reserves the max, then settles at the actual cost", async () => {
  const { service, db, cleanup } = setup();
  try {
    const created = await service.createGeneration(ACCOUNT, {
      type: "text-to-image",
      model: "flux-dev",
      prompt: "a calm clinic hero"
    });
    assert.equal(created.replay, false);
    assert.equal(created.job.credits.reserved, 2);
    assert.equal(db.balance(ACCOUNT), 98);

    const row = db.getJob(created.job.id);
    const finished = await service.pollJob(row);
    assert.equal(finished.status, "completed");
    assert.equal(finished.charged_credits, 2);
    assert.equal(db.balance(ACCOUNT), 98);

    const job = service.publicJob(finished);
    assert.equal(job.outputs.length, 1);
    assert.match(job.outputs[0].url, /^https:\/\/proxy\.test\/files\/acct_test_account\/job_/);
    assert.equal(job.outputs[0].contentType, "image/png");
    assert.equal(job.credits.charged, 2);
  } finally {
    cleanup();
  }
});

test("a cheaper-than-quote generation refunds the difference", async () => {
  const fake = makeRenderful({
    getGeneration: async () => ({
      id: "gen_1",
      status: "completed",
      outputs: ["https://files.test/out.png"],
      error: null,
      cost: 0.025
    })
  });
  const { service, db, cleanup } = setup({ renderful: fake });
  try {
    const created = await service.createGeneration(ACCOUNT, {
      type: "text-to-image",
      model: "flux-dev",
      prompt: "x"
    });
    assert.equal(db.balance(ACCOUNT), 98);
    const finished = await service.pollJob(db.getJob(created.job.id));
    assert.equal(finished.charged_credits, 1);
    assert.equal(db.balance(ACCOUNT), 99);
    const refund = db.history(ACCOUNT).find((e) => e.op === "refund" && e.note === "quote reconciliation");
    assert.equal(refund.credits, 1);
  } finally {
    cleanup();
  }
});

test("an upstream failure refunds the full reservation", async () => {
  const fake = makeRenderful({
    getGeneration: async () => ({
      id: "gen_1",
      status: "failed",
      outputs: [],
      error: "model overloaded",
      cost: null
    })
  });
  const { service, db, cleanup } = setup({ renderful: fake });
  try {
    const created = await service.createGeneration(ACCOUNT, {
      type: "text-to-image",
      model: "flux-dev",
      prompt: "x"
    });
    assert.equal(db.balance(ACCOUNT), 98);
    const failed = await service.pollJob(db.getJob(created.job.id));
    assert.equal(failed.status, "failed");
    assert.equal(failed.charged_credits, 0);
    assert.match(failed.error, /model overloaded/);
    assert.equal(db.balance(ACCOUNT), 100);
    // A second poll must not refund twice.
    await service.pollJob(db.getJob(created.job.id));
    assert.equal(db.balance(ACCOUNT), 100);
  } finally {
    cleanup();
  }
});

test("a failed create refunds and surfaces the error", async () => {
  const fake = makeRenderful({
    createGeneration: async () => {
      throw Object.assign(new Error("provider down"), { status: 502 });
    }
  });
  const { service, db, cleanup } = setup({ renderful: fake });
  try {
    await assert.rejects(
      service.createGeneration(ACCOUNT, { type: "text-to-image", model: "flux-dev", prompt: "x" }),
      /provider down/
    );
    assert.equal(db.balance(ACCOUNT), 100);
    const jobs = service.listJobs(ACCOUNT);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, "failed");
    assert.equal(jobs[0].credits.charged, 0);
  } finally {
    cleanup();
  }
});

test("a job that exceeds its type timeout is refunded", async () => {
  // DB timestamps use the real clock, so anchor the fake service clock to now.
  let clock = Date.now();
  const { config, cleanup } = testConfig();
  const db = createDb(config.dbPath);
  try {
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([fluxDev]) });
    const fake = makeRenderful({
      getGeneration: async () => ({ id: "gen_1", status: "processing", outputs: [], error: null, cost: null })
    });
    const service = createService({
      config,
      db,
      pricing,
      renderful: fake.renderful,
      storage: createStorage({ config, log: silentLog }),
      signedUrls: createSignedUrls({ config, now: () => clock }),
      stripe: { configured: false, paidEvents: new Set() },
      log: silentLog,
      now: () => clock
    });
    db.ensureAccount(ACCOUNT);
    db.credit(ACCOUNT, 100, { op: "admin" });
    const created = await service.createGeneration(ACCOUNT, {
      type: "text-to-image",
      model: "flux-dev",
      prompt: "x"
    });
    clock += config.jobs.timeoutsMs.image + 1000;
    const failed = await service.pollJob(db.getJob(created.job.id));
    assert.equal(failed.status, "failed");
    assert.match(failed.error, /timed out/);
    assert.equal(db.balance(ACCOUNT), 100);
  } finally {
    db.close();
    cleanup();
  }
});

test("the quote reservation cannot overdraw the balance", async () => {
  const { service, db, cleanup } = setup({ startingBalance: 1 });
  try {
    await assert.rejects(
      service.createGeneration(ACCOUNT, { type: "text-to-image", model: "flux-dev", prompt: "x" }),
      (e) => e.status === 402
    );
    assert.equal(db.balance(ACCOUNT), 1);
    assert.equal(service.listJobs(ACCOUNT).length, 0);
  } finally {
    cleanup();
  }
});

test("Idempotency-Key makes a retry return the same job and debit once", async () => {
  const { service, db, calls, cleanup } = setup();
  try {
    const input = { type: "text-to-image", model: "flux-dev", prompt: "x" };
    const first = await service.createGeneration(ACCOUNT, input, { idempotencyKey: "hero-001" });
    const second = await service.createGeneration(ACCOUNT, input, { idempotencyKey: "hero-001" });
    assert.equal(second.replay, true);
    assert.equal(second.job.id, first.job.id);
    assert.equal(calls.create, 1);
    assert.equal(db.balance(ACCOUNT), 98);
    assert.equal(service.listJobs(ACCOUNT).length, 1);
  } finally {
    cleanup();
  }
});

test("getJob enforces account ownership", async () => {
  const { service, db, cleanup } = setup();
  try {
    const created = await service.createGeneration(ACCOUNT, {
      type: "text-to-image",
      model: "flux-dev",
      prompt: "x"
    });
    await assert.rejects(service.getJob("acct_other", created.job.id), (e) => e.status === 404);
    assert.equal(db.balance(ACCOUNT), 98);
  } finally {
    cleanup();
  }
});

test("checkout + Stripe webhook credits a pack exactly once", async () => {
  const stripe = {
    configured: true,
    paidEvents: new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]),
    createCheckoutSession: async () => ({ id: "cs_test_1", url: "https://checkout.test/cs_test_1" })
  };
  const { service, db, cleanup } = setup({ stripe });
  try {
    const checkout = await service.createCheckout(ACCOUNT, "starter");
    assert.equal(checkout.provider, "stripe");
    assert.equal(checkout.url, "https://checkout.test/cs_test_1");
    assert.equal(db.balance(ACCOUNT), 100);

    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_status: "paid",
          amount_total: 700,
          metadata: { intent_id: checkout.intentId },
          client_reference_id: checkout.intentId
        }
      }
    };
    const applied = await service.handleStripeEvent(event);
    assert.equal(applied.granted, 100);
    assert.equal(db.balance(ACCOUNT), 200);

    const replay = await service.handleStripeEvent(event);
    assert.equal(replay.duplicate, true);
    assert.equal(db.balance(ACCOUNT), 200);

    const replayWithNewEventId = await service.handleStripeEvent({ ...event, id: "evt_2" });
    assert.equal(replayWithNewEventId.alreadyCredited, true);
    assert.equal(db.balance(ACCOUNT), 200);
  } finally {
    cleanup();
  }
});

test("a webhook with the wrong amount is ignored", async () => {
  const stripe = {
    configured: true,
    paidEvents: new Set(["checkout.session.completed"]),
    createCheckoutSession: async () => ({ id: "cs_test_2", url: "https://checkout.test/cs_test_2" })
  };
  const { service, db, cleanup } = setup({ stripe });
  try {
    const checkout = await service.createCheckout(ACCOUNT, "builder");
    const outcome = await service.handleStripeEvent({
      id: "evt_wrong",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_2",
          payment_status: "paid",
          amount_total: 1,
          metadata: { intent_id: checkout.intentId }
        }
      }
    });
    assert.equal(outcome.ignored, "amount_mismatch");
    assert.equal(db.balance(ACCOUNT), 100);
  } finally {
    cleanup();
  }
});

test("an external checkout fallback does not grant credits by itself", async () => {
  const { config, cleanup } = testConfig({ CHECKOUT_FALLBACK_URL: "https://skills.test/credits" });
  const db = createDb(config.dbPath);
  try {
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([fluxDev]) });
    const service = createService({
      config,
      db,
      pricing,
      renderful: makeRenderful().renderful,
      storage: createStorage({ config, log: silentLog }),
      signedUrls: createSignedUrls({ config, now: () => T0 }),
      stripe: { configured: false, paidEvents: new Set() },
      log: silentLog,
      now: () => T0
    });
    db.ensureAccount(ACCOUNT);
    const checkout = await service.createCheckout(ACCOUNT, "starter");
    assert.equal(checkout.provider, "external");
    assert.equal(checkout.creditedAutomatically, false);
    assert.equal(db.balance(ACCOUNT), 0);
  } finally {
    db.close();
    cleanup();
  }
});

test("admin grants are idempotent and visible in history", async () => {
  const { service, db, cleanup } = setup({ startingBalance: 0 });
  try {
    const first = service.adminGrant({ accountId: ACCOUNT, credits: 50, idempotencyKey: "ticket-1" });
    const second = service.adminGrant({ accountId: ACCOUNT, credits: 50, idempotencyKey: "ticket-1" });
    assert.equal(first.balance, 50);
    assert.equal(second.balance, 50);
    assert.equal(second.replayed, true);
    assert.equal(db.balance(ACCOUNT), 50);
    assert.equal(service.historyOf(ACCOUNT).filter((e) => e.op === "admin").length, 1);
  } finally {
    cleanup();
  }
});

test("model listing is exposed through the service", async () => {
  const { service, cleanup } = setup();
  try {
    const models = await service.models({ kind: "image" });
    assert.equal(models.length, 1);
    assert.equal(models[0].id, "flux-dev");
    assert.deepEqual(models[0].credits, { min: 1, max: 2 });
  } finally {
    cleanup();
  }
});
