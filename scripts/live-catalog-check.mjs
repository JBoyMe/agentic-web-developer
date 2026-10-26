#!/usr/bin/env node
/**
 * Live Renderful catalogue drift check.
 *
 * Reads the price tables from skill/references/asset-credits.md and the
 * VERIFIED_MODELS allowlist from scripts/release-check.js, then compares them
 * with the live https://api.renderful.ai/api/v1/models response:
 *
 *   - every documented model id still exists for its media kind
 *   - documented USD min/max match the live cost range
 *   - documented credit ranges equal ceil(usd / $0.05)
 *   - every allowlisted id is still in the catalogue
 *
 * Read-only: no generations are created and nothing is charged.
 *
 * Usage:
 *   node scripts/live-catalog-check.mjs
 *   RENDERFUL_API_KEY=... node scripts/live-catalog-check.mjs   (optional)
 *   node scripts/live-catalog-check.mjs --tolerance=0.05 --json
 *
 * Exit code: 0 when every check passes, 1 on missing ids or drift beyond the
 * tolerance (default: exact match).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.RENDERFUL_BASE || "https://api.renderful.ai/api/v1";
const CREDIT_USD = Number(process.env.CREDIT_USD || 0.05);
const args = process.argv.slice(2);
const AS_JSON = args.includes("--json");
const tolArg = args.find((a) => a.startsWith("--tolerance="));
const TOLERANCE = tolArg ? Number(tolArg.split("=")[1]) : 0;

const KIND_TYPES = {
  Image: ["text-to-image", "image-to-image"],
  Audio: ["text-to-audio", "text-to-music", "audio-to-audio"],
  "3D": ["text-to-3d", "image-to-3d"],
  Video: ["text-to-video", "image-to-video", "video-to-video", "reference-to-video", "subject-to-video"]
};

const ceilCredits = (usd) => (usd === 0 ? 0 : Math.max(1, Math.ceil(usd / CREDIT_USD - 1e-9)));
const money = (n) => `$${Number(n).toFixed(4).replace(/0{1,2}$/, "").replace(/\.$/, "")}`;

function readPriceTable() {
  const file = path.join(ROOT, "skill/references/asset-credits.md");
  const lines = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows = [];
  let kind = null;
  for (const line of lines) {
    const heading = /^###\s+(Image|Audio|3D|Video)\b/.exec(line);
    if (heading) {
      kind = heading[1];
      continue;
    }
    if (/^##\s/.test(line)) {
      kind = null;
      continue;
    }
    if (!kind || !line.startsWith("|")) continue;
    // The tables use en dashes between range endpoints; normalise before parsing.
    const cells = line.replace(/[\u2013\u2014]/g, "-").split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const ids = cells[0]
      .replace(/\*/g, "")
      .split("/")
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9][a-z0-9._-]*$/i.test(s));
    const usdMatch = /\$(\d+(?:\.\d+)?)\s*-\s*\$?(\d+(?:\.\d+)?)/.exec(cells[2] ?? "");
    const creditMatch = /^(\d+)(?:\s*-\s*(\d+))?$/.exec((cells[3] ?? "").replace(/\*/g, ""));
    if (ids.length === 0 || !usdMatch || !creditMatch) continue;
    for (const id of ids) {
      rows.push({
        id,
        kind,
        usd: { min: Number(usdMatch[1]), max: Number(usdMatch[2]) },
        credits: { min: Number(creditMatch[1]), max: Number(creditMatch[2] ?? creditMatch[1]) }
      });
    }
  }
  return rows;
}

function readAllowlist() {
  const file = path.join(ROOT, "scripts/release-check.js");
  const text = fs.readFileSync(file, "utf8");
  const block = /const VERIFIED_MODELS = new Set\(\[([\s\S]*?)\]\);/.exec(text);
  if (!block) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

async function fetchCatalog() {
  const headers = { Accept: "application/json" };
  if (process.env.RENDERFUL_API_KEY) headers.Authorization = `Bearer ${process.env.RENDERFUL_API_KEY}`;
  const res = await fetch(`${BASE.replace(/\/+$/, "")}/models`, { headers });
  if (!res.ok) throw new Error(`GET ${BASE}/models -> HTTP ${res.status}`);
  const body = await res.json();
  const models = Array.isArray(body?.models) ? body.models : [];
  if (models.length === 0) throw new Error("catalogue response contained no models");
  return models;
}

async function main() {
  const documented = readPriceTable();
  const allowlist = readAllowlist();
  const models = await fetchCatalog();
  const liveById = new Map();
  for (const m of models) {
    if (!m?.id) continue;
    const cost = m.cost ?? m.dollar_cost;
    if (!cost || typeof cost.min !== "number") continue;
    const list = liveById.get(m.id) ?? [];
    list.push({ id: m.id, type: m.type, min: cost.min, max: cost.max });
    liveById.set(m.id, list);
  }

  const missing = [];
  const drift = [];
  const math = [];
  const rows = [];

  for (const row of documented) {
    const types = KIND_TYPES[row.kind] ?? [];
    const variants = (liveById.get(row.id) ?? []).filter((v) => types.includes(v.type));
    if (variants.length === 0) {
      missing.push({ ...row, reason: `no live ${row.kind} variant` });
      continue;
    }
    const live = variants.sort((a, b) => a.min - b.min)[0];

    if (
      Math.abs(live.min - row.usd.min) > TOLERANCE ||
      Math.abs(live.max - row.usd.max) > TOLERANCE
    ) {
      drift.push({
        id: row.id,
        type: live.type,
        documented: `${money(row.usd.min)}–${money(row.usd.max)}`,
        live: `${money(live.min)}–${money(live.max)}`
      });
    }

    const expected = { min: ceilCredits(row.usd.min), max: ceilCredits(row.usd.max) };
    if (expected.min !== row.credits.min || expected.max !== row.credits.max) {
      math.push({ id: row.id, documented: `${row.credits.min}-${row.credits.max}`, expected: `${expected.min}-${expected.max}` });
    }

    rows.push({
      id: row.id,
      kind: row.kind,
      type: live.type,
      usd: `${money(row.usd.min)}–${money(row.usd.max)}`,
      credits: `${row.credits.min}-${row.credits.max}`,
      status: drift.some((d) => d.id === row.id) ? "drift" : "ok"
    });
  }

  const missingAllowlist = allowlist.filter((id) => !liveById.has(id));

  const cheapest = {};
  for (const [kind, types] of Object.entries(KIND_TYPES)) {
    const candidates = [];
    for (const variants of liveById.values()) {
      for (const v of variants) if (types.includes(v.type)) candidates.push(v);
    }
    candidates.sort((a, b) => a.min - b.min);
    if (candidates[0]) cheapest[kind] = `${candidates[0].id} ${money(candidates[0].min)}–${money(candidates[0].max)}`;
  }

  const ok = missing.length === 0 && drift.length === 0 && math.length === 0 && missingAllowlist.length === 0;

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          ok,
          base: BASE,
          creditUsd: CREDIT_USD,
          tolerance: TOLERANCE,
          catalogue: { models: models.length, priced: liveById.size },
          documentedRows: documented.length,
          missing,
          drift,
          math,
          missingAllowlist,
          cheapest,
          rows
        },
        null,
        2
      )
    );
  } else {
    console.log(`\nRenderful catalogue check · ${BASE}`);
    console.log(`  catalogue: ${models.length} models (${liveById.size} priced) · documented rows: ${documented.length} · tolerance: $${TOLERANCE}\n`);
    for (const row of rows) {
      console.log(`  ${row.status === "ok" ? "\u2714" : "\u2716"} ${row.id.padEnd(28)} ${row.kind.padEnd(6)} ${row.usd.padEnd(18)} ${row.credits} credits`);
    }
    for (const m of missing) {
      console.log(`  \u2716 ${m.id} — ${m.reason} (documented ${money(m.usd.min)}–${money(m.usd.max)})`);
    }
    for (const d of drift) {
      console.log(`  \u2716 ${d.id} — documented ${d.documented}, live ${d.live} (${d.type})`);
    }
    for (const m of math) {
      console.log(`  \u2716 ${m.id} — credits ${m.documented} vs ceil() ${m.expected}`);
    }
    for (const id of missingAllowlist) {
      console.log(`  \u2716 allowlisted id missing live: ${id}`);
    }
    console.log("\n  cheapest live:");
    for (const [kind, value] of Object.entries(cheapest)) console.log(`    ${kind.padEnd(6)} ${value}`);
    const problems = missing.length + drift.length + math.length + missingAllowlist.length;
    console.log(`\n${ok ? "PASS" : "FAIL"}  ${documented.length - missing.length}/${documented.length} documented models verified${problems ? ` · ${problems} problem(s)` : ""}\n`);
  }

  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(`\nFAIL  ${e.message}\n`);
  process.exitCode = 1;
});
