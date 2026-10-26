import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limit.mjs";

test("allows up to the per-minute budget and then rejects", () => {
  let clock = 0;
  const limiter = createRateLimiter({ perMinute: 3, now: () => clock });
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, true);
  const third = limiter.check("a");
  assert.equal(third.ok, true);
  assert.equal(third.remaining, 0);
  const fourth = limiter.check("a");
  assert.equal(fourth.ok, false);
  assert.ok(fourth.retryAfterMs > 0);
  assert.equal(limiter.check("b").ok, true);
});

test("the window slides as time passes", () => {
  let clock = 0;
  const limiter = createRateLimiter({ perMinute: 2, now: () => clock });
  limiter.check("a");
  clock += 30_000;
  limiter.check("a");
  clock += 31_000;
  // first hit is now older than the window, so one slot is free again
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, false);
});

test("sweep drops idle keys", () => {
  let clock = 0;
  const limiter = createRateLimiter({ perMinute: 2, now: () => clock });
  limiter.check("a");
  limiter.check("b");
  assert.equal(limiter.size(), 2);
  clock += 61_000;
  limiter.sweep();
  assert.equal(limiter.size(), 0);
});
