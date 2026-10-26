#!/usr/bin/env node
/**
 * Build the private skill payload (skilltar.gz) that the installer downloads.
 *
 * The npm package ships only the installer, commands and docs. The actual skill
 * tree (SKILL.md + departments + references + templates + assets) is served from
 * a private URL configured in package.json -> awd.source.
 *
 * Usage:
 *   node scripts/build-skill.js [--out=<file>]
 *
 * Output:
 *   ./skilltar.gz                       (default; upload this file)
 *   ./dist/skill-<version>.json         (sha256 + size + file count record)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PKG = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8").replace(/^\uFEFF/, "")
);
const VERSION = PKG.version;

const argOut = process.argv.find((a) => a.startsWith("--out="));
const OUT = path.resolve(ROOT, argOut ? argOut.slice("--out=".length) : "skilltar.gz");

const REQUIRED = [
  "SKILL.md",
  "departments/INDEX.md",
  "departments/design.md",
  "departments/motion.md",
  "references/asset-builder.md",
  "references/asset-credits.md",
  "references/blender-assets.md",
  "references/mode-e.md",
  "references/licensing.md",
  "templates/template-manifest-template.md",
  "assets/cineblock_ai_blender_addon.py",
];

const EXPECTED_DEPARTMENTS = 11;
const MIN_REFERENCES = 25;
const MIN_TEMPLATES = 10;

function fail(message) {
  console.error(`\n✖ build-skill: ${message}\n`);
  process.exit(1);
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

if (!fs.existsSync(path.join(ROOT, "skill", "SKILL.md"))) {
  fail("skill/SKILL.md not found — run this from the repository root.");
}

// 1. Content gate — fail before shipping a payload with a missing asset/ref.
const skillFiles = listFiles(path.join(ROOT, "skill"));
for (const rel of REQUIRED) {
  if (!skillFiles.includes(rel)) fail(`missing required file: skill/${rel}`);
}

const departments = skillFiles.filter(
  (f) => f.startsWith("departments/") && f.endsWith(".md") && !f.endsWith("INDEX.md") && !f.endsWith("DEPARTMENT-TEMPLATE.md")
);
if (departments.length !== EXPECTED_DEPARTMENTS) {
  fail(`expected ${EXPECTED_DEPARTMENTS} department files, found ${departments.length}`);
}

const referenceCount = skillFiles.filter(
  (f) => f.startsWith("references/") && !f.startsWith("references/knowledge-base/") && f.endsWith(".md")
).length;
if (referenceCount < MIN_REFERENCES) {
  fail(`expected at least ${MIN_REFERENCES} reference playbooks, found ${referenceCount}`);
}

const templateCount = skillFiles.filter(
  (f) => f.startsWith("templates/") && f !== "templates/"
).length;
if (templateCount < MIN_TEMPLATES) {
  fail(`expected at least ${MIN_TEMPLATES} template files, found ${templateCount}`);
}

// 2. Build. Directories are included so empty dirs would survive, but the
//    installer only needs files; `tar -C root skill` keeps the skill/ prefix
//    that findSkillRoot() expects.
if (fs.existsSync(OUT)) fs.rmSync(OUT, { force: true });
execFileSync("tar", ["-czf", OUT, "-C", ROOT, "skill"], { stdio: "pipe" });

// 3. Verify the archive actually contains what we validated on disk.
const entries = execFileSync("tar", ["-tzf", OUT], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const archived = new Set(entries.map((e) => e.replace(/^skill\//, "").replace(/\/$/, "")));
for (const rel of REQUIRED) {
  if (!archived.has(rel)) fail(`archive is missing skill/${rel}`);
}
if (entries.some((e) => e.startsWith("commands/"))) {
  fail("archive must not contain commands/ (those ship in the npm package)");
}

// 4. Record for the release notes / upload audit.
const bytes = fs.readFileSync(OUT);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
const manifest = {
  name: PKG.name,
  version: VERSION,
  file: path.basename(OUT),
  bytes: bytes.length,
  sha256,
  files: entries.filter((e) => !e.endsWith("/")).length,
  entries: entries.length,
  references: referenceCount,
  departments: departments.length,
  templates: templateCount,
  builtAt: new Date().toISOString(),
  currentSource: (PKG.awd && PKG.awd.source) || null,
};

const distDir = path.join(ROOT, "dist");
fs.mkdirSync(distDir, { recursive: true });
const manifestPath = path.join(distDir, `skill-${VERSION}.json`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log("\n✔ skill payload built");
console.log(`  file      ${OUT}`);
console.log(`  version   ${VERSION}`);
console.log(`  size      ${(bytes.length / 1024).toFixed(1)} kB`);
console.log(`  files     ${manifest.files} (${referenceCount} references · ${departments.length} departments · ${templateCount} templates)`);
console.log(`  sha256    ${sha256}`);
console.log(`  manifest  ${path.relative(ROOT, manifestPath)}`);
console.log("\nNext:");
console.log("  1. Upload this file to the private host (new URL — the CDN is immutable, never overwrite).");
console.log("  2. Set package.json -> awd.source to the uploaded URL.");
console.log("  3. npm publish, then run: node scripts/verify-release.js\n");
