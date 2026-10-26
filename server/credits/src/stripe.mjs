import crypto from "node:crypto";
import { badRequest, unavailable, upstream } from "./errors.mjs";
import { safeEqual } from "./signed-url.mjs";

const STRIPE_API = "https://api.stripe.com/v1";
const PAID_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded"
]);

function flatten(params, prefix = "", out = []) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      flatten(value, name, out);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") flatten(item, `${name}[${index}]`, out);
        else out.push([`${name}[${index}]`, String(item)]);
      });
    } else {
      out.push([name, String(value)]);
    }
  }
  return out;
}

export function encodeForm(params) {
  return flatten(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** Parses `t=...,v1=...,v1=...` into its parts without trusting the ordering. */
export function parseSignatureHeader(header) {
  const parts = String(header ?? "").split(",");
  const out = { timestamp: null, signatures: [] };
  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    if (key === "t") out.timestamp = Number.parseInt(value, 10);
    else if (key === "v1") out.signatures.push(value);
  }
  return out;
}

export function verifyWebhookSignature({ rawBody, header, secret, toleranceSec = 300, now = () => Date.now() }) {
  if (!secret) throw unavailable("Stripe webhooks are not configured (STRIPE_WEBHOOK_SECRET missing)");
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw badRequest("Invalid Stripe signature header");
  }
  const age = Math.abs(Math.floor(now() / 1000) - timestamp);
  if (age > toleranceSec) throw badRequest("Stripe signature timestamp is outside the tolerance window");

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const matched = signatures.some((sig) => safeEqual(expected, sig));
  if (!matched) throw badRequest("Invalid Stripe signature");

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw badRequest("Invalid Stripe event JSON");
  }
  if (!event?.id || !event?.type) throw badRequest("Stripe event is missing id/type");
  return event;
}

export function createStripe({ config, fetchImpl = globalThis.fetch, log }) {
  const { secretKey, webhookSecret, successUrl, cancelUrl, toleranceSec } = config.stripe;
  const configured = Boolean(secretKey);

  function requireStripe() {
    if (!configured) throw unavailable("Card checkout is not configured on this server");
  }

  async function createCheckoutSession({ intent, accountId, pack, customerEmail }) {
    requireStripe();
    const success = successUrl || `${config.publicBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${config.publicBaseUrl}/checkout/cancel`;
    const description = `${pack.credits.toLocaleString("en-US")} prepaid asset credits · 1 credit = $${config.pricing.creditUsd} of Renderful generation`;

    const form = encodeForm({
      mode: "payment",
      success_url: success,
      cancel_url: cancel,
      client_reference_id: intent.id,
      customer_email: customerEmail || undefined,
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `${pack.name} — ${pack.credits.toLocaleString("en-US")} asset credits`,
              description
            }
          }
        }
      ],
      metadata: {
        intent_id: intent.id,
        account_id: accountId,
        pack_id: pack.id,
        credits: pack.credits
      },
      payment_intent_data: {
        metadata: {
          intent_id: intent.id,
          account_id: accountId,
          pack_id: pack.id,
          credits: pack.credits
        }
      }
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetchImpl(`${STRIPE_API}/checkout/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": intent.id
        },
        body: form,
        signal: controller.signal
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = body?.error?.message || `HTTP ${res.status}`;
        log?.error("stripe checkout failed", { status: res.status, detail });
        throw upstream(`Stripe checkout failed: ${String(detail).slice(0, 300)}`);
      }
      if (!body?.id || !body?.url) throw upstream("Stripe did not return a checkout URL");
      return { id: body.id, url: body.url, expiresAt: body.expires_at ?? null };
    } catch (e) {
      if (e?.name === "AbortError") throw upstream("Stripe checkout timed out");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function verifyWebhook(rawBody, header) {
    return verifyWebhookSignature({
      rawBody,
      header,
      secret: webhookSecret,
      toleranceSec
    });
  }

  return {
    configured,
    webhookConfigured: Boolean(webhookSecret),
    paidEvents: PAID_EVENTS,
    createCheckoutSession,
    verifyWebhook
  };
}
