import crypto from "node:crypto";
import { forbidden, unauthorized, unavailable } from "./errors.mjs";
import { safeEqual } from "./signed-url.mjs";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

/** Stable, non-reversible account identity derived from the license key. */
export function accountIdFromLicense(licenseKey) {
  const hex = sha256(String(licenseKey).trim());
  return `acct_${hex.slice(0, 32)}`;
}

export function licenseHint(licenseKey) {
  return `sha256:${sha256(String(licenseKey).trim()).slice(0, 12)}`;
}

const truthy = (v) => v === true || v === "true" || v === 1 || v === "1";

function isValid(body) {
  return truthy(body?.valid) || truthy(body?.ok) || truthy(body?.success) || truthy(body?.license?.valid);
}

function planOf(body, fallback) {
  const plan = body?.plan ?? body?.license?.plan ?? body?.data?.plan;
  return typeof plan === "string" ? plan : fallback;
}

export function createAuth({ config, db, log, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  const { validateUrl, skill, plan, cacheMs, allowUnverified } = config.license;

  async function callValidator(licenseKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetchImpl(validateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${licenseKey}`,
          "X-License-Key": licenseKey
        },
        body: JSON.stringify({ skill, plan, licenseKey }),
        signal: controller.signal
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolves a license key to an account. Positive and negative results are
   * cached so the validator is not hit on every asset call. If the validator is
   * unreachable, a previously valid grant continues (grace) but an unknown key
   * does not get access unless the operator explicitly allows unverified use.
   */
  async function authenticate(licenseKey) {
    if (!licenseKey || typeof licenseKey !== "string" || licenseKey.trim().length < 8) {
      throw unauthorized("Provide your license key in the `x-license-key` header");
    }
    const key = licenseKey.trim();
    const accountId = accountIdFromLicense(key);
    const hint = licenseHint(key);

    const cached = db.getLicenseCache(accountId);
    const age = cached ? now() - Date.parse(cached.checked_at) : Infinity;

    if (cached && age < cacheMs) {
      if (!cached.valid) throw forbidden("License key is not valid for this skill");
      db.ensureAccount(accountId, hint);
      return { accountId, plan: cached.plan, cached: true };
    }

    if (!validateUrl) {
      if (!allowUnverified) {
        throw unavailable("License validation is not configured on this server");
      }
      db.setLicenseCache(accountId, true, plan);
      db.ensureAccount(accountId, hint);
      log?.warn("license validation disabled; accepting key (dev mode)", { accountId });
      return { accountId, plan, cached: false, unverified: true };
    }

    try {
      const { status, body } = await callValidator(key);
      if (status === 401 || status === 403 || (status < 500 && !isValid(body))) {
        db.setLicenseCache(accountId, false, planOf(body, plan));
        throw forbidden("License key is not valid for this skill");
      }
      if (status >= 500) throw new Error(`validator HTTP ${status}`);
      if (!isValid(body)) {
        db.setLicenseCache(accountId, false, planOf(body, plan));
        throw forbidden("License key is not valid for this skill");
      }
      const resolvedPlan = planOf(body, plan);
      db.setLicenseCache(accountId, true, resolvedPlan);
      db.ensureAccount(accountId, hint);
      return { accountId, plan: resolvedPlan, cached: false };
    } catch (e) {
      if (e?.status === 403 || e?.status === 401) throw e;
      // Validator down: honour the last known-good grant, otherwise fail closed.
      if (cached?.valid) {
        log?.warn("license validator unavailable; using cached grant", { accountId, error: e.message });
        db.ensureAccount(accountId, hint);
        return { accountId, plan: cached.plan, cached: true, stale: true };
      }
      if (allowUnverified) {
        log?.warn("license validator unavailable; accepting key (dev mode)", { accountId, error: e.message });
        db.setLicenseCache(accountId, true, plan);
        db.ensureAccount(accountId, hint);
        return { accountId, plan, cached: false, unverified: true };
      }
      log?.error("license validation failed", { accountId, error: e.message });
      throw unavailable("Could not verify your license right now — retry shortly");
    }
  }

  function isAdmin(secret) {
    if (!config.adminSecret) return false;
    return safeEqual(config.adminSecret, secret ?? "");
  }

  return { authenticate, isAdmin };
}
