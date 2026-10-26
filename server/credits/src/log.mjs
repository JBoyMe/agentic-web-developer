const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

export function createLogger(level = "info") {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const emit = (name, msg, fields) => {
    if ((LEVELS[name] ?? 2) > threshold) return;
    const line = { ts: new Date().toISOString(), level: name, msg };
    if (fields && typeof fields === "object") Object.assign(line, fields);
    const out = name === "error" || name === "warn" ? console.error : console.log;
    out(JSON.stringify(line));
  };

  return {
    error: (msg, fields) => emit("error", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    debug: (msg, fields) => emit("debug", msg, fields)
  };
}

// Redacts anything that looks like a bearer token or an API key before logging.
export function redact(value) {
  if (value == null) return value;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, "Bearer ***")
    .replace(/\b(sec_live|sk_live|sk_test|rk_live)_[A-Za-z0-9]+\b/g, "$1_***");
}
