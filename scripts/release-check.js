#!/usr/bin/env node
/**
 * Release gate for the whole repository: the private skill payload, the npm
 * package, the credits proxy, pricing tables and documentation all have to
 * agree before anything ships.
 *
 * Usage:
 *   node scripts/release-check.js              # everything
 *   node scripts/release-check.js --no-tests   # skip the proxy test suite
 *   node scripts/release-check.js --json       # machine-readable result
 *
 * Exit code 0 = ship it. Non-zero = a named check failed and printed the fix.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = new Set(process.argv.slice(2));
const SKIP_TESTS = args.has("--no-tests");
const AS_JSON = args.has("--json");

const CREDIT_USD = 0.05;

/** Renderful model ids verified against the live /models catalog (2026-10-26). */
const VERIFIED_MODELS = new Set([
  "flux-dev",
  "flux-schnell",
  "seedream-4.5",
  "gpt-image-2",
  "speech-2.6-turbo",
  "eleven_v3",
  "music-2.5",
  "hunyuan3d-v3",
  "hunyuan3d-v3-i2-3d",
  "hunyuan3d-v2.1",
  "hunyuan3d-v2-multi-view",
  "seedance-1.5-pro",
  "seedance-1.5-pro-i2v",
  "hailuo-2.3",
  "hailuo-2.3-i2v",
  "sora-2",
  "kling-v3",
  "wan-2.6",
  "wan-2.6-i2v",
  "wan-2.7-t2v",
  "wan-2.7-i2v",
  "google-veo-3.1-fast",
  "google-veo-3.1"
]);

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || "" });
    if (!AS_JSON) console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    if (!AS_JSON) console.log(`  ✖ ${name} — ${e.message}`);
    return false;
  }
}

const fail = (message) => {
  throw new Error(message);
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

const ceilCredits = (usd) => (usd === 0 ? 0 : Math.max(1, Math.ceil(usd / CREDIT_USD - 1e-9)));

let PKG = {};
let skillFiles = [];
let referenceFiles = [];

console.log("\nAWD release check\n");

// ── 1. Package + payload metadata ──────────────────────────────────────────
check("package.json parses and has a semver version", () => {
  PKG = JSON.parse(read("package.json"));
  if (!/^\d+\.\d+\.\d+$/.test(PKG.version)) fail(`bad version "${PKG.version}"`);
  return PKG.version;
});

check("awd.source is an https payload URL", () => {
  const source = PKG.awd && PKG.awd.source;
  if (!source) fail("package.json -> awd.source is missing (installer cannot fetch the skill)");
  if (!/^https:\/\//i.test(source)) fail(`awd.source must be https, got ${source}`);
  if (!/tar\.gz|\.tgz/i.test(source)) fail("awd.source should point at a .tar.gz");
  return source.replace(/^https:\/\/([^/]+).*/, "$1");
});

check("installer floor and proxy floor are both declared", () => {
  // The npm package is only the installer, so it keeps a wide floor. The proxy
  // uses node:sqlite and must declare >=22.5 in its own package.json.
  const installer = String(PKG.engines && PKG.engines.node || "").replace(/[^\d.]/g, "");
  if (!installer) fail("package.json is missing engines.node");
  const proxyPkg = JSON.parse(read("server/credits/package.json"));
  const proxy = String(proxyPkg.engines && proxyPkg.engines.node || "").replace(/[^\d.]/g, "");
  const [maj, min] = proxy.split(".").map(Number);
  if (!(maj > 22 || (maj === 22 && min >= 5))) {
    fail(`server/credits/package.json needs engines.node >=22.5 for node:sqlite, got ${proxyPkg.engines && proxyPkg.engines.node}`);
  }
  if (!/Node\s*\*{0,2}\s*(≥|>=)\s*22\.5/.test(read("server/credits/README.md"))) {
    fail("server/credits/README.md does not state the Node ≥22.5 requirement");
  }
  return `installer >=${installer} · proxy >=${proxy}`;
});

// ── 2. Skill payload content ───────────────────────────────────────────────
check("skill tree exists", () => {
  if (!exists("skill/SKILL.md")) fail("skill/SKILL.md is missing");
  skillFiles = walk(path.join(ROOT, "skill"));
  return `${skillFiles.length} files`;
});

check("required playbooks and assets are present", () => {
  const required = [
    "SKILL.md",
    "departments/INDEX.md",
    "references/asset-builder.md",
    "references/asset-credits.md",
    "references/blender-assets.md",
    "references/mode-e.md",
    "references/licensing.md",
    "assets/cineblock_ai_blender_addon.py"
  ];
  const missing = required.filter((rel) => !skillFiles.includes(rel));
  if (missing.length) fail(`missing ${missing.join(", ")}`);
  return `${required.length} required files`;
});

check("11 departments, 25+ references, 10+ templates", () => {
  const depts = skillFiles.filter(
    (f) => f.startsWith("departments/") && f.endsWith(".md") && !/(INDEX|DEPARTMENT-TEMPLATE)\.md$/.test(f)
  );
  referenceFiles = skillFiles.filter(
    (f) => f.startsWith("references/") && f.endsWith(".md") && !f.startsWith("references/knowledge-base/")
  );
  const templates = skillFiles.filter((f) => f.startsWith("templates/")).length;
  if (depts.length !== 11) fail(`expected 11 departments, found ${depts.length}`);
  if (referenceFiles.length < 25) fail(`expected 25+ references, found ${referenceFiles.length}`);
  if (templates < 10) fail(`expected 10+ templates, found ${templates}`);
  return `${depts.length} departments · ${referenceFiles.length} references · ${templates} templates`;
});

check("Blender add-on is a real registerable add-on", () => {
  const py = read("skill/assets/cineblock_ai_blender_addon.py");
  for (const needle of ["bl_info", "def register", "bpy."]) {
    if (!py.includes(needle)) fail(`add-on is missing "${needle}"`);
  }
  return `${(py.length / 1024).toFixed(1)} kB`;
});

// ── 3. Commands ────────────────────────────────────────────────────────────
check("command set is complete (16 sources → 31 installed names)", () => {
  const files = fs.readdirSync(path.join(ROOT, "commands")).filter((f) => f.endsWith(".md"));
  const expected = [
    "agentic-web-developer.md",
    "agentic-web-developer-assets.md",
    "agentic-web-developer-list.md",
    "agentic-web-developer-mode-e.md",
    "agentic-web-developer-taste.md",
    ...["strategy", "research", "content", "design", "frontend", "backend", "motion", "qa", "deploy", "launch", "growth"].map(
      (d) => `agentic-web-developer-${d}.md`
    )
  ];
  const missing = expected.filter((f) => !files.includes(f));
  if (missing.length) fail(`missing command sources: ${missing.join(", ")}`);
  if (files.length !== expected.length) fail(`expected ${expected.length} command sources, found ${files.length}`);
  return `${files.length} sources`;
});

check("every command has valid frontmatter and a description", () => {
  const files = fs.readdirSync(path.join(ROOT, "commands")).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const text = read(path.join("commands", file));
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!match) fail(`${file} has no frontmatter`);
    if (!/^description:\s*\S+/m.test(match[1])) fail(`${file} has no description`);
  }
  return `${files.length} valid`;
});

check("/awd-assets documents proxy mode and credits separation", () => {
  const text = read("commands/agentic-web-developer-assets.md");
  for (const needle of ["AWD_CREDITS_API_URL", "credits proxy", "Idempotency-Key", "separate from the license"]) {
    if (!text.includes(needle)) fail(`assets command is missing "${needle}"`);
  }
  if (/eleven-v3/.test(text)) fail("assets command uses the wrong id eleven-v3 (should be eleven_v3)");
  return "proxy mode wired";
});

// ── 4. Pricing consistency ─────────────────────────────────────────────────
check("credit table prices match ceil(USD / $0.05)", () => {
  const text = read("skill/references/asset-credits.md");
  const rows = text.split(/\r?\n/).filter((line) => /^\|.*?\$[\d.]+\s*[-–—]\s*\$?[\d.]+/.test(line));
  if (rows.length < 20) fail(`only found ${rows.length} priced model rows`);
  const errors = [];
  for (const line of rows) {
    const cols = line.split("|").map((c) => c.trim());
    const first = cols[1] || "";
    if (!first || first.startsWith("*") && !first.includes("`")) continue;
    const usd = /([\d.]+)\s*[-–—]\s*([\d.]+)/.exec(cols[3] || "");
    const credits = /([\d.]+)\s*[-–—]\s*([\d.]+)|^(\d+)$/.exec(cols[4] || "");
    if (!usd || !credits) continue;
    const min = ceilCredits(Number(usd[1]));
    const max = ceilCredits(Number(usd[2]));
    const gotMin = Number(credits[1] || credits[3]);
    const gotMax = Number(credits[2] || credits[3]);
    if (gotMin !== min || gotMax !== max) {
      errors.push(`${first}: shows ${gotMin}-${gotMax}, math says ${min}-${max}`);
    }
  }
  if (errors.length) fail(errors.join("; "));
  return `${rows.length} rows consistent`;
});

check("every model id in the price tables is a verified Renderful id", () => {
  const text = read("skill/references/asset-credits.md");
  const rows = text.split(/\r?\n/).filter((line) => /^\|.*?\$[\d.]+\s*[-–—]/.test(line));
  const unknown = new Set();
  for (const line of rows) {
    const first = (line.split("|")[1] || "").replace(/\*/g, "").trim();
    if (!first || first.startsWith("sfx prompt")) continue;
    for (const raw of first.split("/")) {
      const id = raw.trim().replace(/`/g, "").split(/\s+/)[0];
      if (id && !VERIFIED_MODELS.has(id)) unknown.add(id);
    }
  }
  if (unknown.size) fail(`unverified id(s): ${[...unknown].join(", ")}`);
  return `${VERIFIED_MODELS.size} allowlisted ids`;
});

check("bundled fallback catalog matches the verified ids and prices", () => {
  const text = read("server/credits/src/fallback-catalog.mjs");
  const entries = [...text.matchAll(/id:\s*"([^"]+)"[\s\S]*?cost:\s*\{\s*min:\s*([\d.]+),\s*max:\s*([\d.]+)\s*\}/g)];
  if (entries.length < 20) fail(`only parsed ${entries.length} catalog entries`);
  const unknown = entries.map((e) => e[1]).filter((id) => !VERIFIED_MODELS.has(id));
  if (unknown.length) fail(`unverified id(s): ${unknown.join(", ")}`);
  const bad = entries.filter(
    (e) => ceilCredits(Number(e[2])) < 1 && Number(e[2]) > 0
  );
  if (bad.length) fail("catalog has a paid model that rounds to 0 credits");
  return `${entries.length} entries`;
});

check("no stale model ids anywhere in the skill or commands", () => {
  const docs = [
    ...skillFiles.filter((f) => f.endsWith(".md")).map((f) => `skill/${f}`),
    ...fs.readdirSync(path.join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => `commands/${f}`)
  ];
  const bad = [];
  for (const rel of docs) {
    const text = read(rel);
    if (/\beleven-v3\b/.test(text)) bad.push(`${rel}: eleven-v3`);
    if (/hunyuan3d-v3-image/.test(text)) bad.push(`${rel}: hunyuan3d-v3-image`);
  }
  if (bad.length) fail(bad.join("; "));
  return `${docs.length} docs scanned`;
});

// ── 5. Credits proxy ───────────────────────────────────────────────────────
check("credits proxy files are present", () => {
  const required = [
    "server/credits/package.json",
    "server/credits/.env.example",
    "server/credits/Dockerfile",
    "server/credits/docker-compose.yml",
    "server/credits/schema.sql",
    "server/credits/README.md",
    "server/credits/src/server.mjs",
    "server/credits/src/service.mjs",
    "server/credits/src/db.mjs"
  ];
  const missing = required.filter((rel) => !exists(rel));
  if (missing.length) fail(`missing ${missing.join(", ")}`);
  return `${required.length} files`;
});

check("proxy modules pass node --check", () => {
  const files = walk(path.join(ROOT, "server", "credits")).filter((f) => f.endsWith(".mjs"));
  for (const rel of files) {
    try {
      execFileSync(process.execPath, ["--check", path.join(ROOT, "server", "credits", rel)], { stdio: "pipe" });
    } catch (e) {
      fail(`${rel}: ${String(e.stderr || e.message).split(/\r?\n/)[0]}`);
    }
  }
  return `${files.length} modules`;
});

check(".env.example covers every required secret and keeps secrets blank", () => {
  const env = read("server/credits/.env.example");
  for (const key of [
    "RENDERFUL_API_KEY",
    "FILE_SIGNING_SECRET",
    "PUBLIC_BASE_URL",
    "LICENSE_VALIDATE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "ADMIN_SECRET",
    "CREDIT_USD",
    "DATA_DIR"
  ]) {
    if (!new RegExp(`^${key}=`, "m").test(env)) fail(`missing ${key}`);
  }
  for (const key of ["RENDERFUL_API_KEY", "FILE_SIGNING_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ADMIN_SECRET"]) {
    const line = env.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (line && line.split("=").slice(1).join("=").trim() !== "") fail(`${key} has a value in .env.example`);
  }
  return "10 required keys · secrets blank";
});

check("proxy README documents the endpoint contract", () => {
  const text = read("server/credits/README.md");
  for (const route of [
    "/v1/credits/balance",
    "/v1/credits/quote",
    "/v1/credits/generations",
    "/v1/credits/checkout",
    "/v1/stripe/webhook",
    "/v1/admin/grant",
    "/files/"
  ]) {
    if (!text.includes(route)) fail(`README is missing ${route}`);
  }
  if (!/signed|signature/i.test(text)) fail("README does not document signed file URLs");
  return "all routes documented";
});

if (!SKIP_TESTS) {
  check("credits proxy test suite passes", () => {
    const out = execFileSync(
      process.execPath,
      ["--test", "server/credits/test/*.test.mjs"],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe", env: { ...process.env, NODE_ENV: "test" } }
    );
    const passed = (out.match(/^ℹ pass (\d+)$/m) || [])[1];
    const failed = (out.match(/^ℹ fail (\d+)$/m) || [])[1];
    if (failed && failed !== "0") fail(`${failed} test(s) failed`);
    if (!passed) fail("could not read the test summary");
    if (Number(passed) < 60) fail(`only ${passed} tests ran (expected 60+)`);
    return `${passed} passing`;
  });
}

// ── 6. Docs + ops surface ──────────────────────────────────────────────────
check("README and LICENSING keep plans and credits separate", () => {
  const readme = read("README.md");
  const licensing = read("docs/LICENSING.md");
  if (!/separate from every plan/i.test(readme)) fail("README lost the plans/credits separation");
  if (!/1 credit = \$0\.05/.test(readme)) fail("README lost the credit rate");
  if (!/AWD_CREDITS_API_URL/.test(readme)) fail("README does not document managed credits");
  if (!/zero credits/i.test(licensing)) fail("LICENSING does not state that plans include zero credits");
  if (!/AWD_CREDITS_API_URL/.test(licensing)) fail("LICENSING does not document the managed transport");
  return "separation intact";
});

check("production runbook exists and covers deploy + rollback", () => {
  if (!exists("docs/PRODUCTION.md")) fail("docs/PRODUCTION.md is missing");
  const text = read("docs/PRODUCTION.md");
  for (const needle of ["Payload", "npm publish", "Stripe", "Blender", "Rollback", "QA"]) {
    if (!text.includes(needle)) fail(`PRODUCTION.md is missing "${needle}"`);
  }
  return `${text.split(/\r?\n/).length} lines`;
});

check("release scripts are wired into package.json", () => {
  for (const script of ["release:build", "release:verify", "release:check", "test:credits"]) {
    if (!PKG.scripts || !PKG.scripts[script]) fail(`missing npm script "${script}"`);
  }
  return "4 scripts";
});

// ── 7. Hygiene ─────────────────────────────────────────────────────────────
check(".gitignore keeps server/ and scripts/ tracked", () => {
  const gi = read(".gitignore");
  for (const rule of ["!/server/", "!/server/**", "!/scripts/", "!/scripts/**", "!/package.json"]) {
    if (!gi.includes(rule)) fail(`.gitignore is missing ${rule}`);
  }
  return "exceptions present";
});

check("no real secrets are checked in", () => {
  const files = [
    "package.json",
    "README.md",
    ...walk(path.join(ROOT, "docs")).map((f) => `docs/${f}`),
    ...walk(path.join(ROOT, "commands")).map((f) => `commands/${f}`),
    ...walk(path.join(ROOT, "server", "credits")).map((f) => `server/credits/${f}`),
    ...walk(path.join(ROOT, "scripts")).map((f) => `scripts/${f}`),
    ...skillFiles.map((f) => `skill/${f}`)
  ].filter((f) => /\.(md|js|mjs|json|sql|yml|example|py)$/.test(f));

  const isPlaceholder = (v) =>
    !v ||
    /^(?:your|you@|admin@|user@|example\.|changeme|change-me|placeholder|xxx+|secret|<|\$\{|\$[A-Z_]|\.\.\.|…)/i.test(v) ||
    /example\.(?:com|org)|yourdomain|your-host|your-key|yourserver/i.test(v) ||
    /secret|placeholder|dummy|mock|sample|test|fake/i.test(v) ||
    /^(?:env\.|process\.|config\.|os\.|Deno\.|import\.meta)/.test(v);

  const patterns = [
    [/\bsk_live_[A-Za-z0-9]{10,}/g, "Stripe live key"],
    [/\bwhsec_[A-Za-z0-9]{20,}/g, "Stripe webhook secret"],
    [/\brf_[A-Za-z0-9]{24,}/g, "Renderful key"],
    [/\bAKIA[0-9A-Z]{16}\b/g, "AWS access key"],
    [/\bsec_live_[A-Za-z0-9]{16,}/g, "Animotion license key"],
    [/(?:AGENTIC_ADMIN_EMAIL|adminEmail)[ \t]*[:=][ \t]*["']?([^\s"'`<>=]+)/g, "admin email value", (m) => !isPlaceholder(m[1])],
    [/(?:AGENTIC_ADMIN_SECRET|ADMIN_SECRET|adminSecret)[ \t]*[:=][ \t]*["']?([^\s"'`<>=]{8,})/g, "admin secret value", (m) => !isPlaceholder(m[1])],
    [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, "private key"]
  ];
  const hits = [];
  for (const rel of files) {
    const text = read(rel);
    for (const [re, label, allow] of patterns) {
      for (const m of text.matchAll(re)) {
        if (allow && !allow(m)) continue;
        hits.push(`${rel} (${label})`);
        break;
      }
    }
  }
  if (hits.length) fail(hits.join("; "));
  if (fs.existsSync(path.join(ROOT, "server", "credits", ".env"))) fail("server/credits/.env must never be committed");
  return `${files.length} files clean`;
});

check("npm package ships installer + commands + docs (no skill, no proxy)", () => {
  const raw = execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32"
  });
  const info = JSON.parse(raw.slice(raw.indexOf("[")))[0];
  const files = info.files.map((f) => f.path);
  if (files.some((f) => f.startsWith("skill/"))) fail("npm package would leak skill/");
  if (files.some((f) => f.startsWith("server/"))) fail("npm package would leak the proxy source");
  if (!files.includes("bin/install.js")) fail("npm package is missing bin/install.js");
  if (!files.includes("package.json")) fail("npm package is missing package.json");
  return `${files.length} files · ${(info.size / 1024).toFixed(1)} kB`;
});

// ── Summary ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;

if (AS_JSON) {
  console.log(JSON.stringify({ ok: failed.length === 0, passed, failed: failed.length, results }, null, 2));
} else {
  console.log(`\n${failed.length === 0 ? "✔ release check passed" : "✖ release check failed"}`);
  console.log(`  ${passed}/${results.length} checks · ${SKIP_TESTS ? "tests skipped" : "tests included"}`);
  if (failed.length === 0) {
    console.log("\nNext:");
    console.log("  1. node scripts/build-skill.js            # rebuild skilltar.gz + dist manifest");
    console.log("  2. upload skilltar.gz to a NEW immutable URL, update awd.source");
    console.log("  3. node scripts/verify-release.js         # install the payload in a throwaway HOME");
    console.log("  4. npm login && npm publish");
    console.log("  5. deploy server/credits with real secrets (docs/PRODUCTION.md)\n");
  } else {
    console.log("\nFix the ✖ checks above, then re-run: node scripts/release-check.js\n");
  }
}

process.exit(failed.length === 0 ? 0 : 1);
