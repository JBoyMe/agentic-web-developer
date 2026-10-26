import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { badRequest, unavailable, upstream, HttpError } from "./errors.mjs";

const DONE = new Set(["completed", "succeeded", "success", "done"]);
const FAILED = new Set(["failed", "error", "cancelled", "canceled"]);

export function isDone(status) {
  return DONE.has(String(status ?? "").toLowerCase());
}

export function isFailed(status) {
  return FAILED.has(String(status ?? "").toLowerCase());
}

/** Pulls every http(s) output URL out of the shapes Renderful has used. */
export function extractOutputUrls(payload) {
  const urls = [];
  const seen = new Set();
  const push = (value) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value) && !seen.has(value)) {
      seen.add(value);
      urls.push(value);
    }
  };
  const walk = (node, depth) => {
    if (node == null || depth > 6) return;
    if (typeof node === "string") return push(node);
    if (Array.isArray(node)) return node.forEach((item) => walk(item, depth + 1));
    if (typeof node !== "object") return;
    if (typeof node.url === "string") push(node.url);
    if (typeof node.href === "string") push(node.href);
    if (typeof node.download_url === "string") push(node.download_url);
    for (const key of ["outputs", "output", "urls", "generation", "task", "data", "result", "results", "artifacts"]) {
      if (key in node) walk(node[key], depth + 1);
    }
  };

  walk(payload?.outputs, 0);
  walk(payload?.output, 0);
  walk(payload?.urls, 0);
  for (const key of ["generation", "task", "data", "result"]) walk(payload?.[key], 0);
  return urls;
}

function authHeaders(config) {
  if (!config?.renderful?.apiKey) {
    throw unavailable("Renderful is not configured on this server (RENDERFUL_API_KEY missing)");
  }
  return {
    Authorization: `Bearer ${config.renderful.apiKey}`,
    Accept: "application/json"
  };
}

async function readJson(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 500) };
  }
  return body;
}

function upstreamError(res, body, what) {
  const detail = body?.message || body?.error || `HTTP ${res.status}`;
  if (res.status === 402) throw upstream(`Renderful rejected the request for payment: ${detail}`);
  if (res.status === 401 || res.status === 403) {
    throw upstream("Renderful rejected the server API key", { status: res.status });
  }
  if (res.status === 429) throw upstream("Renderful rate limit reached; retry shortly", { status: 429 });
  throw upstream(`Renderful ${what} failed: ${String(detail).slice(0, 400)}`, { status: res.status });
}

export function createRenderful({ config, log, fetchImpl = globalThis.fetch }) {
  const base = config.renderful.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.renderful.requestTimeoutMs ?? 30000;

  async function request(url, init, what) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      const body = await readJson(res);
      if (!res.ok) upstreamError(res, body, what);
      return body;
    } catch (e) {
      if (e?.name === "AbortError") throw upstream(`Renderful ${what} timed out after ${timeoutMs}ms`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Creates one generation. Returns the normalised queued task, including the
   * authoritative `cost` in USD that the ledger reconciles against.
   */
  async function createGeneration(input) {
    if (!input || typeof input !== "object") throw badRequest("generation input is required");
    const payload = { ...input };
    // Server-side webhooks are not used: the proxy polls, which keeps job state
    // in one place and works from any deployment without a public callback URL.
    delete payload.webhook_url;

    const body = await request(
      `${base}/generations`,
      {
        method: "POST",
        headers: { ...authHeaders(config), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      "generation create"
    );

    const id = body?.id ?? body?.generation?.id ?? body?.task?.id ?? body?.data?.id;
    if (!id) throw upstream("Renderful did not return a generation id");
    const cost = Number(body?.cost ?? body?.generation?.cost ?? body?.data?.cost);

    return {
      id: String(id),
      type: body?.type ?? input.type,
      model: body?.model ?? input.model,
      status: body?.status ?? "queued",
      cost: Number.isFinite(cost) ? cost : null,
      costFormatted: body?.cost_formatted ?? null,
      pollUrl: body?.poll_url ?? null,
      raw: body
    };
  }

  async function getGeneration(providerId) {
    if (!providerId) throw badRequest("provider generation id is required");
    const body = await request(
      `${base}/generations/${encodeURIComponent(providerId)}`,
      { method: "GET", headers: authHeaders(config) },
      "generation poll"
    );
    if (!body?.id && !body?.status) throw upstream("Renderful returned an empty generation payload");
    const cost = Number(body?.cost);
    return {
      id: String(body?.id ?? providerId),
      status: String(body?.status ?? "").toLowerCase(),
      outputs: extractOutputUrls(body),
      error: body?.error ?? body?.message ?? null,
      cost: Number.isFinite(cost) ? cost : null,
      raw: body
    };
  }

  /**
   * Streams an output to disk while enforcing the configured size cap. Never
   * buffers a full video in memory.
   */
  async function download(url, destPath, { maxBytes = 200 * 1024 * 1024 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs * 4);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (!res.ok) throw upstream(`Output download failed: HTTP ${res.status}`);
      const declared = Number(res.headers?.get?.("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw upstream(`Output is larger than the ${maxBytes} byte limit`);
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const tmp = `${destPath}.part`;
      let bytes = 0;
      const source = Readable.fromWeb(res.body);
      const limiter = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            callback(upstream(`Output is larger than the ${maxBytes} byte limit`));
            return;
          }
          callback(null, chunk);
        }
      });

      try {
        await pipeline(source, limiter, fs.createWriteStream(tmp));
      } catch (e) {
        try {
          fs.rmSync(tmp, { force: true });
        } catch {
          /* ignore */
        }
        if (bytes > maxBytes && !(e instanceof HttpError)) {
          throw upstream(`Output is larger than the ${maxBytes} byte limit`);
        }
        throw e;
      }

      fs.renameSync(tmp, destPath);
      return { bytes, contentType: res.headers?.get?.("content-type") ?? null };
    } catch (e) {
      if (e?.name === "AbortError") throw upstream("Output download timed out");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  return { createGeneration, getGeneration, download };
}
