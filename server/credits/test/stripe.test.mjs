import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { encodeForm, parseSignatureHeader, verifyWebhookSignature } from "../src/stripe.mjs";

const SECRET = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });

function signature(timestamp, payload = body, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

test("encodeForm flattens nested Stripe parameters", () => {
  const form = encodeForm({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 700 } }],
    metadata: { intent_id: "chk_1" }
  });
  const params = new URLSearchParams(form);
  assert.equal(params.get("mode"), "payment");
  assert.equal(params.get("line_items[0][quantity]"), "1");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "700");
  assert.equal(params.get("metadata[intent_id]"), "chk_1");
});

test("parseSignatureHeader collects multiple v1 signatures", () => {
  const parsed = parseSignatureHeader("t=1700000000,v1=abc,v1=def");
  assert.equal(parsed.timestamp, 1700000000);
  assert.deepEqual(parsed.signatures, ["abc", "def"]);
});

test("a valid Stripe signature yields the event", () => {
  const t = Math.floor(Date.now() / 1000);
  const header = `t=${t},v1=${signature(t)}`;
  const event = verifyWebhookSignature({ rawBody: body, header, secret: SECRET });
  assert.equal(event.id, "evt_1");
  assert.equal(event.type, "checkout.session.completed");
});

test("a wrong signature is rejected", () => {
  const t = Math.floor(Date.now() / 1000);
  assert.throws(
    () => verifyWebhookSignature({ rawBody: body, header: `t=${t},v1=${"a".repeat(64)}`, secret: SECRET }),
    (e) => e.status === 400
  );
});

test("a stale timestamp is rejected", () => {
  const t = Math.floor(Date.now() / 1000) - 10_000;
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: body,
        header: `t=${t},v1=${signature(t)}`,
        secret: SECRET,
        toleranceSec: 300
      }),
    /tolerance/
  );
});

test("a different body invalidates the signature", () => {
  const t = Math.floor(Date.now() / 1000);
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: body + " ",
        header: `t=${t},v1=${signature(t)}`,
        secret: SECRET
      }),
    /Invalid Stripe signature/
  );
});

test("missing configuration fails closed", () => {
  assert.throws(
    () => verifyWebhookSignature({ rawBody: body, header: "t=1,v1=x", secret: "" }),
    (e) => e.status === 503
  );
});
