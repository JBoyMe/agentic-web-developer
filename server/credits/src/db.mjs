import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { paymentRequired, notFound } from "./errors.mjs";

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  license_hint TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  op TEXT NOT NULL,
  credits INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  job_id TEXT,
  pack_id TEXT,
  note TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_idem ON ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_account ON ledger(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT,
  status TEXT NOT NULL,
  type TEXT,
  model TEXT,
  input_json TEXT,
  quote_min INTEGER NOT NULL DEFAULT 0,
  quote_max INTEGER NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  charged_credits INTEGER,
  provider_cost REAL,
  outputs_json TEXT,
  error TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idem ON jobs(account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS jobs_account ON jobs(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS checkout_intents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  session_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS license_cache (
  account_id TEXT PRIMARY KEY,
  valid INTEGER NOT NULL,
  plan TEXT,
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export function createDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);

  const stmts = {
    getAccount: db.prepare("SELECT * FROM accounts WHERE id = ?"),
    insertAccount: db.prepare(
      "INSERT INTO accounts (id, license_hint, balance, created_at, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING"
    ),
    setBalance: db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?"),
    bumpBalance: db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?"),
    getLedgerByKey: db.prepare("SELECT * FROM ledger WHERE idempotency_key = ?"),
    insertLedger: db.prepare(
      `INSERT INTO ledger (id, account_id, op, credits, balance_after, job_id, pack_id, note, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    listLedger: db.prepare("SELECT * FROM ledger WHERE account_id = ? ORDER BY created_at DESC LIMIT ?"),
    insertJob: db.prepare(
      `INSERT INTO jobs (id, account_id, provider_id, status, type, model, input_json, quote_min, quote_max,
                         reserved_credits, charged_credits, provider_cost, outputs_json, error, idempotency_key, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    getJob: db.prepare("SELECT * FROM jobs WHERE id = ?"),
    getJobByKey: db.prepare("SELECT * FROM jobs WHERE account_id = ? AND idempotency_key = ?"),
    updateJob: db.prepare(
      `UPDATE jobs SET provider_id = ?, status = ?, charged_credits = ?, provider_cost = ?, outputs_json = ?,
                       error = ?, updated_at = ?, completed_at = ? WHERE id = ?`
    ),
    pendingJobs: db.prepare(
      "SELECT * FROM jobs WHERE status IN ('queued','processing','storing') ORDER BY updated_at ASC LIMIT ?"
    ),
    recentJobs: db.prepare("SELECT * FROM jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?"),
    insertIntent: db.prepare(
      `INSERT INTO checkout_intents (id, account_id, pack_id, credits, price_cents, status, session_id, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, 'created', NULL, ?, NULL)`
    ),
    getIntent: db.prepare("SELECT * FROM checkout_intents WHERE id = ?"),
    setIntentSession: db.prepare("UPDATE checkout_intents SET session_id = ? WHERE id = ?"),
    markIntentPaid: db.prepare("UPDATE checkout_intents SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'"),
    webhookSeen: db.prepare("SELECT id FROM webhook_events WHERE id = ?"),
    insertWebhook: db.prepare("INSERT INTO webhook_events (id, type, created_at) VALUES (?, ?, ?)"),
    getLicense: db.prepare("SELECT * FROM license_cache WHERE account_id = ?"),
    setLicense: db.prepare(
      `INSERT INTO license_cache (account_id, valid, plan, checked_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET valid = excluded.valid, plan = excluded.plan, checked_at = excluded.checked_at`
    ),
    getMeta: db.prepare("SELECT value FROM meta WHERE key = ?"),
    setMeta: db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
  };

  let depth = 0;
  function tx(fn) {
    if (depth > 0) return fn();
    depth++;
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* already rolled back */
      }
      throw e;
    } finally {
      depth--;
    }
  }

  function ensureAccount(accountId, licenseHint = null) {
    stmts.insertAccount.run(accountId, licenseHint, now(), now());
    return stmts.getAccount.get(accountId);
  }

  function getAccount(accountId) {
    return stmts.getAccount.get(accountId) || null;
  }

  function balance(accountId) {
    const row = stmts.getAccount.get(accountId);
    return row ? row.balance : 0;
  }

  function record(accountId, op, credits, balanceAfter, extra = {}) {
    stmts.insertLedger.run(
      id("led"),
      accountId,
      op,
      credits,
      balanceAfter,
      extra.jobId ?? null,
      extra.packId ?? null,
      extra.note ?? null,
      extra.idempotencyKey ?? null,
      now()
    );
  }

  /**
   * Atomic debit. Returns { balance, entry } and is idempotent when a key is supplied.
   */
  function debit(accountId, credits, extra = {}) {
    if (!Number.isInteger(credits) || credits <= 0) throw new Error("credits must be a positive integer");
    return tx(() => {
      if (extra.idempotencyKey) {
        const prior = stmts.getLedgerByKey.get(extra.idempotencyKey);
        if (prior) return { balance: prior.balance_after, entry: prior, replayed: true };
      }
      const row = stmts.getAccount.get(accountId);
      if (!row) throw notFound("Account not found");
      if (row.balance < credits) {
        throw paymentRequired("Not enough credits", {
          balance: row.balance,
          required: credits
        });
      }
      const next = row.balance - credits;
      stmts.setBalance.run(next, now(), accountId);
      record(accountId, extra.op || "spend", -credits, next, extra);
      return { balance: next, replayed: false };
    });
  }

  /** Atomic credit (grant or refund). Idempotent with a key. */
  function credit(accountId, credits, extra = {}) {
    if (!Number.isInteger(credits) || credits <= 0) throw new Error("credits must be a positive integer");
    return tx(() => {
      if (extra.idempotencyKey) {
        const prior = stmts.getLedgerByKey.get(extra.idempotencyKey);
        if (prior) return { balance: prior.balance_after, entry: prior, replayed: true };
      }
      ensureAccount(accountId);
      const row = stmts.getAccount.get(accountId);
      const next = row.balance + credits;
      stmts.setBalance.run(next, now(), accountId);
      record(accountId, extra.op || "grant", credits, next, extra);
      return { balance: next, replayed: false };
    });
  }

  function history(accountId, limit = 50) {
    return stmts.listLedger.all(accountId, Math.min(Math.max(limit, 1), 200));
  }

  function createJob(job) {
    const ts = now();
    stmts.insertJob.run(
      job.id,
      job.accountId,
      job.providerId ?? null,
      job.status,
      job.type ?? null,
      job.model ?? null,
      job.inputJson ?? "{}",
      job.quoteMin ?? 0,
      job.quoteMax ?? 0,
      job.reservedCredits ?? 0,
      job.chargedCredits ?? null,
      job.providerCost ?? null,
      job.outputsJson ?? null,
      job.error ?? null,
      job.idempotencyKey ?? null,
      ts,
      ts,
      null
    );
    return getJob(job.id);
  }

  function getJob(jobId) {
    return stmts.getJob.get(jobId) || null;
  }

  function getJobByKey(accountId, key) {
    if (!key) return null;
    return stmts.getJobByKey.get(accountId, key) || null;
  }

  function updateJob(jobId, patch) {
    const current = getJob(jobId);
    if (!current) throw notFound("Job not found");
    stmts.updateJob.run(
      patch.providerId ?? current.provider_id,
      patch.status ?? current.status,
      patch.chargedCredits ?? current.charged_credits,
      patch.providerCost ?? current.provider_cost,
      patch.outputsJson ?? current.outputs_json,
      patch.error ?? current.error,
      now(),
      patch.completedAt ?? current.completed_at,
      jobId
    );
    return getJob(jobId);
  }

  function pendingJobs(limit = 5) {
    return stmts.pendingJobs.all(limit);
  }

  function recentJobs(accountId, limit = 20) {
    return stmts.recentJobs.all(accountId, Math.min(Math.max(limit, 1), 100));
  }

  function createIntent({ accountId, packId, credits, priceCents }) {
    const intentId = id("chk");
    stmts.insertIntent.run(intentId, accountId, packId, credits, priceCents, now());
    return getIntent(intentId);
  }

  function getIntent(intentId) {
    return stmts.getIntent.get(intentId) || null;
  }

  function attachSession(intentId, sessionId) {
    stmts.setIntentSession.run(sessionId, intentId);
  }

  function markIntentPaid(intentId) {
    return stmts.markIntentPaid.run(now(), intentId).changes > 0;
  }

  function webhookSeen(eventId) {
    return Boolean(stmts.webhookSeen.get(eventId));
  }

  function recordWebhook(eventId, type) {
    stmts.insertWebhook.run(eventId, type ?? null, now());
  }

  function getLicenseCache(accountId) {
    return stmts.getLicense.get(accountId) || null;
  }

  function setLicenseCache(accountId, valid, plan) {
    stmts.setLicense.run(accountId, valid ? 1 : 0, plan ?? null, now());
  }

  function getMeta(key) {
    const row = stmts.getMeta.get(key);
    return row ? row.value : null;
  }

  function setMeta(key, value) {
    stmts.setMeta.run(key, String(value));
  }

  function close() {
    db.close();
  }

  return {
    raw: db,
    tx,
    ensureAccount,
    getAccount,
    balance,
    debit,
    credit,
    history,
    createJob,
    getJob,
    getJobByKey,
    updateJob,
    pendingJobs,
    recentJobs,
    createIntent,
    getIntent,
    attachSession,
    markIntentPaid,
    webhookSeen,
    recordWebhook,
    getLicenseCache,
    setLicenseCache,
    getMeta,
    setMeta,
    close
  };
}
