import crypto from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
};

/**
 * HMAC-signed, expiring URLs for generated files. The signature covers the
 * relative path and the expiry, so a leaked URL cannot be edited to reach
 * another account's directory or live forever.
 */
export function createSignedUrls({ config, now = () => Date.now() }) {
  const secret = config?.signingSecret || "";
  const baseUrl = (config?.publicBaseUrl || "").replace(/\/+$/, "");
  const defaultTtl = Number(config?.fileUrlTtlSec) > 0 ? Number(config.fileUrlTtlSec) : 3600;

  if (!secret) {
    // A missing secret is a deployment error in production; `server.mjs` refuses
    // to start without it. In tests we still need deterministic signatures.
    throw new Error("FILE_SIGNING_SECRET is required for signed file URLs");
  }

  function mac(relPath, exp) {
    return b64url(crypto.createHmac("sha256", secret).update(`${relPath}\n${exp}`).digest());
  }

  function encodePath(relPath) {
    return relPath.split("/").map((s) => encodeURIComponent(s)).join("/");
  }

  function sign(relPath, { ttlSec = defaultTtl } = {}) {
    const clean = String(relPath).replace(/^\/+/, "");
    const exp = Math.floor(now() / 1000) + Math.max(30, Math.floor(ttlSec));
    return `${baseUrl}/files/${encodePath(clean)}?exp=${exp}&sig=${mac(clean, exp)}`;
  }

  function verify(relPath, exp, sig) {
    const clean = String(relPath).replace(/^\/+/, "");
    const expires = Number.parseInt(exp, 10);
    if (!Number.isFinite(expires)) return { ok: false, reason: "missing_expiry" };
    if (expires * 1000 < now()) return { ok: false, reason: "expired" };
    const expected = mac(clean, expires);
    if (!safeEqual(expected, sig)) return { ok: false, reason: "bad_signature" };
    return { ok: true, expires };
  }

  return { sign, verify, ttlSec: defaultTtl };
}

export { safeEqual };
