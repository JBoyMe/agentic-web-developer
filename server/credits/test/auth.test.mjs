import test from "node:test";
import assert from "node:assert/strict";
import { accountIdFromLicense, createAuth, licenseHint } from "../src/auth.mjs";
import { createDb } from "../src/db.mjs";
import { silentLog, testConfig } from "./helpers.mjs";

function setup(overrides = {}, fetchImpl) {
  const { config, dir, cleanup } = testConfig(overrides);
  const db = createDb(config.dbPath);
  const auth = createAuth({ config, db, log: silentLog, fetchImpl });
  return {
    config,
    db,
    auth,
    cleanup: () => {
      db.close();
      cleanup();
    }
  };
}

test("account ids are stable, derived from the key, and never contain it", () => {
  const a = accountIdFromLicense("license-key-abcdefgh");
  const b = accountIdFromLicense("  license-key-abcdefgh  ");
  assert.equal(a, b);
  assert.match(a, /^acct_[a-f0-9]{32}$/);
  assert.ok(!a.includes("license-key"));
  assert.match(licenseHint("license-key-abcdefgh"), /^sha256:[a-f0-9]{12}$/);
});

test("a valid license creates an account and caches the result", async () => {
  let calls = 0;
  const { auth, db, cleanup } = setup(
    { LICENSE_VALIDATE_URL: "https://license.test/validate" },
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ valid: true, plan: "pro" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );
  try {
    const first = await auth.authenticate("license-key-12345678");
    assert.equal(first.plan, "pro");
    assert.equal(first.cached, false);
    assert.ok(db.getAccount(first.accountId));

    const second = await auth.authenticate("license-key-12345678");
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
  } finally {
    cleanup();
  }
});

test("an invalid license is rejected and cached as invalid", async () => {
  let calls = 0;
  const { auth, cleanup } = setup(
    { LICENSE_VALIDATE_URL: "https://license.test/validate" },
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );
  try {
    await assert.rejects(auth.authenticate("bad-key-12345678"), (e) => e.status === 403);
    await assert.rejects(auth.authenticate("bad-key-12345678"), (e) => e.status === 403);
    assert.equal(calls, 1);
  } finally {
    cleanup();
  }
});

test("a validator outage keeps a previously valid grant but rejects unknown keys", async () => {
  let mode = "ok";
  const { auth, db, cleanup } = setup(
    {
      LICENSE_VALIDATE_URL: "https://license.test/validate",
      ALLOW_UNVERIFIED_LICENSES: "false",
      LICENSE_CACHE_MS: "0"
    },
    async () => {
      if (mode === "down") throw new Error("ECONNREFUSED");
      return new Response(JSON.stringify({ valid: true, plan: "pro" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );
  try {
    const accountId = accountIdFromLicense("known-key-12345678");
    await auth.authenticate("known-key-12345678");
    db.setLicenseCache(accountId, true, "pro");

    mode = "down";
    const grace = await auth.authenticate("known-key-12345678");
    assert.equal(grace.accountId, accountId);
    assert.equal(grace.stale, true);

    await assert.rejects(auth.authenticate("unknown-key-12345678"), (e) => e.status === 503);
  } finally {
    cleanup();
  }
});

test("unverified mode is allowed only when configured", async () => {
  const { auth, cleanup } = setup(
    { LICENSE_VALIDATE_URL: "", ALLOW_UNVERIFIED_LICENSES: "true" },
    async () => {
      throw new Error("should not be called");
    }
  );
  try {
    const result = await auth.authenticate("dev-key-12345678");
    assert.equal(result.unverified, true);
  } finally {
    cleanup();
  }
});

test("admin secrets are compared safely", () => {
  const { auth, cleanup } = setup({ ADMIN_SECRET: "super-secret" });
  try {
    assert.equal(auth.isAdmin("super-secret"), true);
    assert.equal(auth.isAdmin("wrong"), false);
    assert.equal(auth.isAdmin(""), false);
  } finally {
    cleanup();
  }
});
