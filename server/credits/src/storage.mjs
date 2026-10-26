import fs from "node:fs";
import path from "node:path";
import { notFound } from "./errors.mjs";

const CONTENT_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "model/gltf-binary": "glb",
  "model/gltf+json": "gltf",
  "application/octet-stream": "bin"
};

const EXT_BY_KIND = { image: "png", audio: "mp3", video: "mp4", "3d": "glb", text: "txt" };
const SAFE_EXT = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "avif", "svg",
  "mp4", "webm", "mov", "mkv", "mp3", "wav", "ogg", "opus", "m4a",
  "glb", "gltf", "bin", "txt", "json"
]);

const safeSegment = (value) => String(value).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);

function extFromUrl(url) {
  try {
    const name = path.basename(new URL(url).pathname).toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    return SAFE_EXT.has(ext) ? ext : "";
  } catch {
    return "";
  }
}

export function extensionFor(url, contentType, kind) {
  const byType = CONTENT_TYPES[String(contentType ?? "").split(";")[0].trim().toLowerCase()];
  if (byType) return byType;
  const fromUrl = extFromUrl(url);
  if (fromUrl) return fromUrl;
  return EXT_BY_KIND[String(kind ?? "").toLowerCase()] ?? "bin";
}

export function createStorage({ config, log }) {
  const root = path.resolve(config.filesDir);

  /** Absolute path for a stored relative path; rejects traversal and outside-root paths. */
  function resolve(relPath) {
    const clean = String(relPath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean || clean.includes("\0")) throw notFound("File not found");
    const abs = path.resolve(root, clean);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw notFound("File not found");
    return abs;
  }

  async function saveOutputs({ accountId, jobId, urls, kind, download }) {
    const account = safeSegment(accountId);
    const job = safeSegment(jobId);
    const saved = [];
    let index = 0;

    for (const url of urls) {
      index += 1;
      // Probe with a small HEAD-free approach: download to a provisional path,
      // then rename once the extension is known from the response headers.
      const provisional = `${account}/${job}/${index}.part`;
      const absProvisional = resolve(provisional);
      let result;
      try {
        result = await download(url, absProvisional, { maxBytes: config.maxOutputBytes });
      } catch (e) {
        try {
          fs.rmSync(absProvisional, { force: true });
        } catch {
          /* ignore */
        }
        throw e;
      }

      const ext = extensionFor(url, result.contentType, kind);
      const relPath = `${account}/${job}/${index}.${ext}`;
      const absFinal = resolve(relPath);
      fs.mkdirSync(path.dirname(absFinal), { recursive: true });
      fs.renameSync(absProvisional, absFinal);

      saved.push({
        index,
        path: relPath,
        bytes: result.bytes,
        contentType: result.contentType ?? null,
        sourceUrl: url
      });
      log?.debug("output stored", { jobId, path: relPath, bytes: result.bytes });
    }

    return saved;
  }

  function removeJobFiles(accountId, jobId) {
    const abs = resolve(`${safeSegment(accountId)}/${safeSegment(jobId)}`);
    try {
      fs.rmSync(abs, { recursive: true, force: true });
    } catch (e) {
      log?.warn("failed to remove job files", { error: e.message });
    }
  }

  return { root, resolve, saveOutputs, removeJobFiles };
}
