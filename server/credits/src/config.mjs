import path from "node:path";

const bool = (v, fallback = false) => {
  if (v === undefined || v === null || v === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(v));
};

const int = (v, fallback) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const num = (v, fallback) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

export const DEFAULT_PACKS = [
  { id: "starter", name: "Starter", credits: 100, priceCents: 700 },
  { id: "builder", name: "Builder", credits: 300, priceCents: 2100 },
  { id: "production", name: "Production", credits: 1000, priceCents: 6500 },
  { id: "agency", name: "Agency", credits: 3000, priceCents: 18900 }
];

function readPacks(raw) {
  if (!raw) return DEFAULT_PACKS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("expected a non-empty array");
    return parsed.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? p.id),
      credits: int(p.credits, 0),
      priceCents: int(p.priceCents, 0)
    }));
  } catch (e) {
    throw new Error(`CREDIT_PACKS_JSON is invalid: ${e.message}`);
  }
}

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(env.DATA_DIR || path.join(process.cwd(), "data"));
  return {
    env: env.NODE_ENV || "development",
    isProduction: env.NODE_ENV === "production",
    port: int(env.PORT, 8787),
    host: env.HOST || "0.0.0.0",
    dataDir,
    dbPath: path.join(dataDir, "credits.sqlite"),
    filesDir: path.join(dataDir, "files"),
    catalogCachePath: path.join(dataDir, "renderful-models.json"),
    publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${int(env.PORT, 8787)}`).replace(/\/+$/, ""),
    allowOrigin: env.ALLOW_ORIGIN || "",
    trustProxy: bool(env.TRUST_PROXY, false),
    maxBodyBytes: int(env.MAX_BODY_BYTES, 1024 * 1024),
    maxOutputBytes: int(env.MAX_OUTPUT_BYTES, 200 * 1024 * 1024),

    renderful: {
      baseUrl: (env.RENDERFUL_BASE || "https://api.renderful.ai/api/v1").replace(/\/+$/, ""),
      apiKey: env.RENDERFUL_API_KEY || "",
      catalogTtlMs: int(env.MODELS_TTL_MS, 15 * 60 * 1000),
      requestTimeoutMs: int(env.RENDERFUL_TIMEOUT_MS, 30 * 1000)
    },

    pricing: {
      creditUsd: num(env.CREDIT_USD, 0.05),
      basis: (env.PRICING_BASIS || "max").toLowerCase(),
      allowUnknownModels: bool(env.ALLOW_UNKNOWN_MODELS, false)
    },

    jobs: {
      pollIntervalMs: int(env.POLL_INTERVAL_MS, 5000),
      pollMinIntervalMs: int(env.POLL_MIN_INTERVAL_MS, 2000),
      maxPollBatch: int(env.MAX_POLL_BATCH, 5),
      timeoutsMs: {
        image: int(env.TIMEOUT_IMAGE_MS, 120 * 1000),
        audio: int(env.TIMEOUT_AUDIO_MS, 180 * 1000),
        "3d": int(env.TIMEOUT_3D_MS, 300 * 1000),
        video: int(env.TIMEOUT_VIDEO_MS, 600 * 1000),
        other: int(env.TIMEOUT_OTHER_MS, 600 * 1000)
      }
    },

    license: {
      validateUrl: env.LICENSE_VALIDATE_URL || "",
      skill: env.LICENSE_SKILL || "agentic-web-developer",
      plan: env.LICENSE_PLAN || "pro",
      cacheMs: int(env.LICENSE_CACHE_MS, 60 * 60 * 1000),
      allowUnverified: bool(env.ALLOW_UNVERIFIED_LICENSES, env.NODE_ENV !== "production")
    },

    stripe: {
      secretKey: env.STRIPE_SECRET_KEY || "",
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
      successUrl: env.STRIPE_SUCCESS_URL || "",
      cancelUrl: env.STRIPE_CANCEL_URL || "",
      toleranceSec: int(env.STRIPE_TOLERANCE_SEC, 300)
    },

    checkoutFallbackUrl: env.CHECKOUT_FALLBACK_URL || "",

    signingSecret: env.FILE_SIGNING_SECRET || "",
    fileUrlTtlSec: int(env.FILE_URL_TTL_SEC, 60 * 60),
    adminSecret: env.ADMIN_SECRET || "",

    rateLimit: {
      enabled: bool(env.RATE_LIMIT_ENABLED, true),
      perMinute: int(env.RATE_LIMIT_PER_MIN, 60)
    },

    packs: readPacks(env.CREDIT_PACKS_JSON),

    logLevel: (env.LOG_LEVEL || "info").toLowerCase()
  };
}
