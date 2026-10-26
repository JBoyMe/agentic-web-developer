/**
 * Small in-memory sliding-window limiter. Single-process only — if you run more
 * than one replica, put the limit at the edge (nginx/Cloudflare) instead or
 * swap this for Redis.
 */
export function createRateLimiter({ perMinute = 60, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  const max = Math.max(1, perMinute);

  function check(key) {
    const current = now();
    const cutoff = current - windowMs;
    const list = (hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (list.length >= max) {
      hits.set(key, list);
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, list[0] + windowMs - current) };
    }
    list.push(current);
    hits.set(key, list);
    return { ok: true, remaining: Math.max(0, max - list.length), retryAfterMs: 0 };
  }

  function sweep() {
    const cutoff = now() - windowMs;
    for (const [key, list] of hits) {
      const kept = list.filter((ts) => ts > cutoff);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }

  return { check, sweep, size: () => hits.size };
}
