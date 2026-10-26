-- Credits proxy schema (SQLite). The service also applies this idempotently at boot;
-- this file exists for operators who inspect or migrate the database.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
