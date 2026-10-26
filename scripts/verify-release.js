#!/usr/bin/env node
/**
 * Verify the built skill payload through the real installer, in a throwaway HOME.
 * This is the last gate before uploading/publishing: it proves an end user can
 * install the archive and gets every reference, the Blender add-on and all
 * slash commands (including /awd-assets).
 *
 * Usage:
 *   node scripts/verify-release.js [--source=<file|url>]
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PKG = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8").replace(/^\uFEFF/, "")
);
const argSource = process.argv.find((a) => a.startsWith("--source="));
const SOURCE = argSource
  ? path.resolve(ROOT, argSource.slice("--source=".length))
  : path.join(ROOT, "skilltar.gz");

const commandsDir = path.join(ROOT, "commands");
const expectedCommands = fs
  .readdirSync(commandsDir)
  .filter((f) => f.endsWith(".md"))
  .flatMap((f) => {
    const base = f.replace(/\.md$/, "");
    return base.startsWith("agentic-web-developer-")
      ? [f, `awd-${base.slice("agentic-web-developer-".length)}.md`]
      : [f];
  });

function fail(message) {
  console.error(`\n✖ verify-release: ${message}\n`);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) {
  fail(`payload not found: ${SOURCE} (run: npm run release:build)`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "awd-release-"));
const skillDir = path.join(tmp, ".opencode", "skills", "agentic-web-developer");
const cmdDir = path.join(tmp, ".config", "opencode", "command");

console.log(`\nVerifying ${path.relative(ROOT, SOURCE) || SOURCE} with the real installer…`);

try {
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, "bin", "install.js"),
      "install",
      "--agent=opencode",
      `--source=${SOURCE}`,
      `--home=${tmp}`,
      "--force",
    ],
    { stdio: "pipe", encoding: "utf8" }
  );
} catch (e) {
  fail(`installer exited non-zero:\n${e.stdout || ""}${e.stderr || e.message}`);
}

// 1. Skill tree
for (const rel of [
  "SKILL.md",
  "departments/INDEX.md",
  "references/asset-builder.md",
  "references/asset-credits.md",
  "references/blender-assets.md",
  "references/mode-e.md",
  "assets/cineblock_ai_blender_addon.py",
]) {
  if (!fs.existsSync(path.join(skillDir, rel))) fail(`installed skill is missing ${rel}`);
}

const installedRefs = fs
  .readdirSync(path.join(skillDir, "references"))
  .filter((f) => f.endsWith(".md")).length;
if (installedRefs < 25) fail(`expected 25+ references, found ${installedRefs}`);

const skillText = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
for (const needle of ["Asset Builder", "Stage AB.", "asset-credits.md", "blender-assets.md"]) {
  if (!skillText.includes(needle)) fail(`installed SKILL.md is missing "${needle}"`);
}

// 2. Slash commands
const installedCmds = fs.existsSync(cmdDir)
  ? fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md"))
  : [];
for (const expected of expectedCommands) {
  if (!installedCmds.includes(expected)) fail(`missing slash command: ${expected}`);
}
if (!installedCmds.includes("awd-assets.md")) fail("missing /awd-assets alias");
if (!installedCmds.includes("agentic-web-developer-assets.md")) {
  fail("missing /agentic-web-developer-assets command");
}

// 3. payload details
const bytes = fs.readFileSync(SOURCE);
const sha256 = require("crypto").createHash("sha256").update(bytes).digest("hex");

console.log("\n✔ release verified");
console.log(`  version           ${PKG.version}`);
console.log(`  payload           ${(bytes.length / 1024).toFixed(1)} kB · sha256 ${sha256}`);
console.log(`  skill references  ${installedRefs}`);
console.log(`  slash commands    ${installedCmds.length}`);
console.log(`  assets add-on     present`);
console.log(`  source URL        ${(PKG.awd && PKG.awd.source) || "(not set)"}`);
console.log(`\n  Install path tested: ${skillDir}\n`);

fs.rmSync(tmp, { recursive: true, force: true });
