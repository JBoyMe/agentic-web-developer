import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "../src/db.mjs";

function makeDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-db-"));
  const db = createDb(path.join(dir, "credits.sqlite"));
  return {
    db,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test("credit and debit update the balance with ledger entries", () => {
  const { db, cleanup } = makeDb();
  try {
    db.credit("acct_a", 10, { op: "purchase", packId: "starter" });
    assert.equal(db.balance("acct_a"), 10);
    const result = db.debit("acct_a", 3, { op: "reserve", jobId: "job_1" });
    assert.equal(result.balance, 7);
    assert.equal(db.balance("acct_a"), 7);
    const history = db.history("acct_a");
    assert.equal(history.length, 2);
    const reserve = history.find((h) => h.op === "reserve");
    assert.ok(reserve);
    assert.equal(reserve.credits, -3);
  } finally {
    cleanup();
  }
});

test("debit refuses to overdraw", () => {
  const { db, cleanup } = makeDb();
  try {
    db.credit("acct_a", 2);
    assert.throws(() => db.debit("acct_a", 3), (e) => e.status === 402 && e.code === "payment_required");
    assert.equal(db.balance("acct_a"), 2);
  } finally {
    cleanup();
  }
});

test("idempotency keys make debit and credit replay-safe", () => {
  const { db, cleanup } = makeDb();
  try {
    db.credit("acct_a", 10);
    const first = db.debit("acct_a", 4, { idempotencyKey: "spend-1" });
    const second = db.debit("acct_a", 4, { idempotencyKey: "spend-1" });
    assert.equal(first.balance, 6);
    assert.equal(second.balance, 6);
    assert.equal(second.replayed, true);
    assert.equal(db.balance("acct_a"), 6);

    const refund1 = db.credit("acct_a", 4, { op: "refund", idempotencyKey: "refund-1" });
    const refund2 = db.credit("acct_a", 4, { op: "refund", idempotencyKey: "refund-1" });
    assert.equal(refund1.balance, 10);
    assert.equal(refund2.balance, 10);
    assert.equal(refund2.replayed, true);
    assert.equal(db.balance("acct_a"), 10);
  } finally {
    cleanup();
  }
});

test("jobs are addressable by id and idempotency key", () => {
  const { db, cleanup } = makeDb();
  try {
    db.ensureAccount("acct_a");
    const created = db.createJob({
      id: "job_1",
      accountId: "acct_a",
      status: "queued",
      type: "text-to-image",
      model: "flux-dev",
      quoteMin: 1,
      quoteMax: 2,
      reservedCredits: 2,
      idempotencyKey: "idem-1"
    });
    assert.equal(created.status, "queued");
    assert.equal(created.reserved_credits, 2);
    assert.equal(db.getJobByKey("acct_a", "idem-1").id, "job_1");
    assert.equal(db.getJobByKey("acct_a", "missing"), null);

    const updated = db.updateJob("job_1", { status: "completed", chargedCredits: 1 });
    assert.equal(updated.status, "completed");
    assert.equal(updated.charged_credits, 1);
    assert.equal(db.pendingJobs(10).length, 0);
  } finally {
    cleanup();
  }
});

test("checkout intents can only be marked paid once", () => {
  const { db, cleanup } = makeDb();
  try {
    const intent = db.createIntent({
      accountId: "acct_a",
      packId: "starter",
      credits: 100,
      priceCents: 700
    });
    assert.equal(intent.status, "created");
    db.attachSession(intent.id, "cs_1");
    assert.equal(db.getIntent(intent.id).session_id, "cs_1");
    assert.equal(db.markIntentPaid(intent.id), true);
    assert.equal(db.markIntentPaid(intent.id), false);
    assert.equal(db.getIntent(intent.id).status, "paid");
  } finally {
    cleanup();
  }
});

test("license cache stores validity and plan", () => {
  const { db, cleanup } = makeDb();
  try {
    db.setLicenseCache("acct_a", false, "pro");
    assert.equal(db.getLicenseCache("acct_a").valid, 0);
    db.setLicenseCache("acct_a", true, "studio");
    assert.equal(db.getLicenseCache("acct_a").valid, 1);
    assert.equal(db.getLicenseCache("acct_a").plan, "studio");
  } finally {
    cleanup();
  }
});
