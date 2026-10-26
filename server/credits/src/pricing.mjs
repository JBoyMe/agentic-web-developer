import fs from "node:fs";
import path from "node:path";
import { badRequest, unavailable } from "./errors.mjs";
import { FALLBACK_MODELS } from "./fallback-catalog.mjs";

const round4 = (n) => Math.round(n * 10000) / 10000;

const toPositive = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function creditsFromUsd(usd, creditUsd) {
  const rate = toPositive(creditUsd, 0.05);
  const cents = toPositive(usd, 0);
  if (cents === 0) return 0;
  return Math.max(1, Math.ceil(cents / rate - 1e-9));
}

/**
 * Normalises the two shapes Renderful uses (`cost` on a model, `dollar_cost` too)
 * into a plain `{min,max}` USD range. Returns null when the model has no price.
 */
export function normalizeCost(model) {
  const source = model?.cost ?? model?.dollar_cost;
  if (!source) return null;
  const min = toPositive(source.min, NaN);
  const max = toPositive(source.max, NaN);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  const lo = Number.isFinite(min) ? min : max;
  const hi = Number.isFinite(max) ? max : min;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

export function indexModels(models, source = "renderful-catalog") {
  const byKey = new Map();
  const byId = new Map();
  for (const raw of models ?? []) {
    if (!raw?.id) continue;
    const cost = normalizeCost(raw);
    if (!cost) continue;
    const entry = {
      id: String(raw.id),
      name: String(raw.name ?? raw.id),
      type: String(raw.type ?? ""),
      provider: raw.provider ? String(raw.provider) : undefined,
      cost,
      capabilities: raw.capabilities ?? {},
      source
    };
    byKey.set(`${entry.id}|${entry.type}`, entry);
    const variants = byId.get(entry.id) ?? [];
    variants.push(entry);
    byId.set(entry.id, variants);
  }
  return { byKey, byId };
}

export function createPricing({ config, log, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  const rate = toPositive(config?.pricing?.creditUsd, 0.05);
  const basis = config?.pricing?.basis === "min" ? "min" : "max";
  const allowUnknown = Boolean(config?.pricing?.allowUnknownModels);

  let catalog = null;
  let fetchedAt = 0;

  const fallback = indexModels(FALLBACK_MODELS, "bundled-fallback");

  function readCacheFile() {
    const file = config?.catalogCachePath;
    if (!file) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(parsed?.models) || parsed.models.length === 0) return null;
      return { models: parsed.models, fetchedAt: Number(parsed.fetchedAt) || 0 };
    } catch {
      return null;
    }
  }

  function writeCacheFile(models) {
    const file = config?.catalogCachePath;
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ fetchedAt: now(), models }, null, 2));
    } catch (e) {
      log?.warn("catalog cache write failed", { error: e.message });
    }
  }

  async function fetchCatalog() {
    const url = `${config.renderful.baseUrl.replace(/\/+$/, "")}/models`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.renderful.requestTimeoutMs ?? 30000);
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const models = Array.isArray(body?.models) ? body.models : [];
      if (models.length === 0) throw new Error("catalog was empty");
      return models;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Returns the indexed catalog, using memory → disk → live → bundled fallback.
   * `force` skips the in-memory TTL when an operator wants fresh prices.
   */
  async function getCatalog({ force = false } = {}) {
    const ttl = config?.renderful?.catalogTtlMs ?? 15 * 60 * 1000;
    if (!force && catalog && now() - fetchedAt < ttl) return catalog;

    const disk = readCacheFile();
    if (!force && disk && now() - disk.fetchedAt < ttl) {
      catalog = indexModels(disk.models);
      fetchedAt = disk.fetchedAt;
      if (catalog.byKey.size > 0) return catalog;
    }

    try {
      const models = await fetchCatalog();
      catalog = indexModels(models);
      if (catalog.byKey.size === 0) throw new Error("catalog had no priced models");
      fetchedAt = now();
      writeCacheFile(models);
      log?.info("renderful catalog loaded", { models: models.length, priced: catalog.byKey.size });
      return catalog;
    } catch (e) {
      log?.warn("renderful catalog fetch failed; using cached/fallback prices", { error: e.message });
      if (catalog?.byKey?.size > 0) return catalog;
      if (disk) {
        const fromDisk = indexModels(disk.models);
        if (fromDisk.byKey.size > 0) {
          catalog = fromDisk;
          fetchedAt = disk.fetchedAt;
          return catalog;
        }
      }
      catalog = fallback;
      fetchedAt = now();
      return catalog;
    }
  }

  function lookup(index, model, type) {
    return index.byKey.get(`${model}|${type}`) ?? null;
  }

  /**
   * Prices one generation. The client always quotes a min–max credit range and
   * reserves the max; the proxy reconciles against the `cost` Renderful returns.
   */
  async function quote({ type, model, numOutputs, num_outputs, duration } = {}) {
    if (!model || typeof model !== "string") throw badRequest("`model` is required");
    if (!type || typeof type !== "string") throw badRequest("`type` is required");
    const requested = numOutputs ?? num_outputs ?? 1;
    const count = Math.min(Math.max(Number.parseInt(requested, 10) || 1, 1), 10);

    const index = await getCatalog();
    const entry = lookup(index, model, type);

    if (!entry && !allowUnknown) {
      const variants = index.byId.get(model);
      if (variants?.length) {
        const supported = [...new Set(variants.map((v) => v.type))].join(", ");
        throw badRequest(`Model "${model}" does not support type "${type}" (supported: ${supported})`);
      }
      throw badRequest(`Unknown model "${model}" — not present in the live Renderful catalog`);
    }

    const cost = entry?.cost ?? { min: 0, max: 0 };
    const minUsd = round4(cost.min * count);
    const maxUsd = round4(cost.max * count);
    const minCredits = creditsFromUsd(minUsd, rate);
    const maxCredits = Math.max(minCredits, creditsFromUsd(maxUsd, rate));
    const reservedCredits = basis === "min" ? minCredits : maxCredits;

    return {
      model,
      type,
      name: entry?.name ?? model,
      known: Boolean(entry),
      basis,
      numOutputs: count,
      duration: Number.isFinite(Number(duration)) ? Number(duration) : undefined,
      creditUsd: rate,
      usd: { min: minUsd, max: maxUsd },
      credits: { min: minCredits, max: maxCredits, reserved: reservedCredits },
      source: entry?.source ?? "unlisted"
    };
  }

  /** List catalog models, optionally filtered by type/kind, with credit prices. */
  async function listModels({ type, kind, q, limit = 200 } = {}) {
    const index = await getCatalog();
    const wanted = type || kindToTypes(kind);
    const needle = q ? String(q).toLowerCase() : "";
    const seen = new Set();
    const out = [];
    for (const entry of index.byKey.values()) {
      if (wanted && !wanted.includes(entry.type)) continue;
      if (needle && !`${entry.id} ${entry.name}`.toLowerCase().includes(needle)) continue;
      const key = `${entry.id}|${entry.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        provider: entry.provider,
        usd: entry.cost,
        credits: {
          min: creditsFromUsd(entry.cost.min, rate),
          max: Math.max(creditsFromUsd(entry.cost.min, rate), creditsFromUsd(entry.cost.max, rate))
        }
      });
      if (out.length >= Math.min(Math.max(Number(limit) || 200, 1), 1000)) break;
    }
    out.sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
    return out;
  }

  function ensureConfigured() {
    if (!config?.renderful?.baseUrl) throw unavailable("Renderful base URL is not configured");
  }

  ensureConfigured();

  return {
    creditUsd: rate,
    creditsFromUsd: (usd) => creditsFromUsd(usd, rate),
    getCatalog,
    quote,
    listModels
  };
}

export function kindToTypes(kind) {
  switch (String(kind ?? "").toLowerCase()) {
    case "image":
    case "img":
      return ["text-to-image", "image-to-image"];
    case "audio":
    case "voice":
    case "music":
      return ["text-to-audio", "text-to-music", "audio-to-audio"];
    case "video":
      return ["text-to-video", "image-to-video", "video-to-video", "reference-to-video", "subject-to-video"];
    case "3d":
    case "model":
      return ["text-to-3d", "image-to-3d"];
    default:
      return undefined;
  }
}
