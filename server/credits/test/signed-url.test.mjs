import test from "node:test";
import assert from "node:assert/strict";
import { createSignedUrls } from "../src/signed-url.mjs";

const T0 = Date.parse("2026-01-01T00:00:00Z");

function setup(ttlSec = 3600) {
  let clock = T0;
  const urls = createSignedUrls({
    config: {
      signingSecret: "test-signing-secret-0123456789abcdef",
      publicBaseUrl: "https://proxy.test",
      fileUrlTtlSec: ttlSec
    },
    now: () => clock
  });
  return {
    urls,
    advance: (ms) => {
      clock += ms;
    }
  };
}

test("signed URLs carry the path, expiry and signature", () => {
  const { urls } = setup();
  const url = new URL(urls.sign("acct_1/job_1/1.png"));
  assert.equal(url.origin, "https://proxy.test");
  assert.equal(url.pathname, "/files/acct_1/job_1/1.png");
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  assert.match(exp, /^\d+$/);
  assert.match(sig, /^[A-Za-z0-9_-]{20,}$/);
  assert.deepEqual(urls.verify("acct_1/job_1/1.png", exp, sig), { ok: true, expires: Number(exp) });
});

test("tampered paths and signatures are rejected", () => {
  const { urls } = setup();
  const url = new URL(urls.sign("acct_1/job_1/1.png"));
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  assert.equal(urls.verify("acct_2/job_1/1.png", exp, sig).ok, false);
  assert.equal(urls.verify("acct_1/job_1/1.png", exp, `${sig.slice(0, -1)}A`).ok, false);
  assert.equal(urls.verify("acct_1/job_1/1.png", "not-a-number", sig).ok, false);
});

test("expired URLs are rejected", () => {
  const { urls, advance } = setup(60);
  const url = new URL(urls.sign("acct_1/job_1/1.png"));
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  advance(61_000);
  assert.equal(urls.verify("acct_1/job_1/1.png", exp, sig).reason, "expired");
});

test("path segments are URL-encoded", () => {
  const { urls } = setup();
  const signed = urls.sign("acct 1/job/1.png");
  assert.match(signed, /\/files\/acct%201\/job\/1\.png\?/);
});

test("a missing signing secret is a hard error", () => {
  assert.throws(
    () => createSignedUrls({ config: { signingSecret: "", publicBaseUrl: "https://x" } }),
    /FILE_SIGNING_SECRET/
  );
});
