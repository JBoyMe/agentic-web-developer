#!/usr/bin/env node
/**
 * agentic-web-developer installer
 *
 *   npx agentic-web-developer install [--agent=<key>|all] [--source=<url|path>] [--token=<key>]
 *                                     [--license-key=<key> | --admin-email=<e> --admin-secret=<s>]
 *                                     [--force] [--dry-run] [--dir=<path>] [--no-commands]
 *   npx agentic-web-developer detect
 *
 * The npm package ships only this installer (+ docs). The skill payload is
 * resolved from the first available source:
 *
 *   1. --source=<url|path>        explicit flag (URL of a .tar.gz/.zip, or a local folder/archive)
 *   2. AWD_SOURCE=<url|path>      environment variable
 *   3. skill/ next to this file   local development checkout
 *   4. awd.source in package.json configured by the package author
 *
 * Private sources: --token=<key> or AWD_TOKEN=<key> (GITHUB_TOKEN is used
 * for github.com URLs). Installs each agent with its own file format.
 * No dependencies. Node 18+.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const flags = {};
for (const arg of argv) {
  const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] !== undefined ? m[2] : true;
}
const command = argv.find((a) => !a.startsWith("--")) || (flags.detect ? "detect" : "install");

const HOME = flags.home ? path.resolve(flags.home) : os.homedir();
const APPDATA = flags.home
  ? path.join(HOME, "AppData", "Roaming")
  : process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const LOCALAPPDATA = flags.home
  ? path.join(HOME, "AppData", "Local")
  : process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const PKG_ROOT = path.join(__dirname, "..");
const BUNDLED_SKILL = path.join(PKG_ROOT, "skill");
const SKILL_NAME = "agentic-web-developer";
const MARKER = "<!-- agentic-web-developer | installed by npx agentic-web-developer -->";

// format:
//   skill        -> <dirs>/<name>/SKILL.md
//   skill-lower  -> <dirs>/<name>/skill.md
//   rules-mdc    -> <agentRoot>/rules/<name>.mdc   (Cursor rules)
//   rules-md     -> <agentRoot>/rules/<name>.md    (Continue / Augment / Amazon Q)
//   conventions  -> <dirs>/CONVENTIONS.md          (Aider)
// dirs  = candidate skills directories (first existing one wins, else the first is created)
// roots = used by `detect` to decide whether the agent is installed on this machine
const AGENTS = {
  opencode: {
    name: "OpenCode",
    format: "skill",
    roots: [path.join(HOME, ".opencode"), path.join(HOME, ".config", "opencode")],
    dirs: [path.join(HOME, ".opencode", "skills"), path.join(HOME, ".config", "opencode", "skills")]
  },
  claude: {
    name: "Claude Code",
    format: "skill",
    roots: [path.join(HOME, ".claude"), path.join(APPDATA, "claude")],
    dirs: [path.join(HOME, ".claude", "skills"), path.join(APPDATA, "claude", "skills")]
  },
  copilot: {
    name: "GitHub Copilot",
    format: "skill",
    roots: [path.join(APPDATA, "github-copilot"), path.join(HOME, ".config", "github-copilot")],
    dirs: [path.join(APPDATA, "github-copilot", "skills"), path.join(HOME, ".config", "github-copilot", "skills")]
  },
  cursor: {
    name: "Cursor",
    format: "rules-mdc",
    roots: [path.join(HOME, ".cursor"), path.join(LOCALAPPDATA, "cursor")],
    dirs: [path.join(HOME, ".cursor", "skills"), path.join(LOCALAPPDATA, "cursor", "skills")]
  },
  windsurf: {
    name: "Windsurf (Codeium)",
    format: "skill-lower",
    roots: [path.join(HOME, ".codeium", "windsurf"), path.join(LOCALAPPDATA, "windsurf")],
    dirs: [path.join(HOME, ".codeium", "windsurf", "skills"), path.join(LOCALAPPDATA, "windsurf", "skills")]
  },
  cody: {
    name: "Cody (Sourcegraph)",
    format: "skill",
    roots: [path.join(HOME, ".cody"), path.join(APPDATA, "cody")],
    dirs: [path.join(HOME, ".cody", "skills"), path.join(APPDATA, "cody", "skills")]
  },
  codium: {
    name: "Codium",
    format: "skill-lower",
    roots: [path.join(HOME, ".codium"), path.join(LOCALAPPDATA, "codium")],
    dirs: [path.join(HOME, ".codium", "skills"), path.join(LOCALAPPDATA, "codium", "skills")]
  },
  aider: {
    name: "Aider",
    format: "conventions",
    roots: [path.join(HOME, ".aider")],
    dirs: [path.join(HOME, ".aider", "skills")]
  },
  continue: {
    name: "Continue",
    format: "rules-md",
    roots: [path.join(HOME, ".continue")],
    dirs: [path.join(HOME, ".continue", "skills")]
  },
  codex: {
    name: "Codex (OpenAI)",
    format: "skill",
    roots: [path.join(HOME, ".codex"), path.join(HOME, ".agents")],
    dirs: [path.join(HOME, ".codex", "skills"), path.join(HOME, ".agents", "skills")]
  },
  roo: {
    name: "Roo Code",
    format: "skill",
    roots: [path.join(HOME, ".roo"), path.join(HOME, ".agents")],
    dirs: [path.join(HOME, ".roo", "skills"), path.join(HOME, ".agents", "skills")]
  },
  cline: {
    name: "Cline",
    format: "skill",
    roots: [path.join(HOME, ".cline"), path.join(HOME, ".agents")],
    dirs: [path.join(HOME, ".cline", "skills"), path.join(HOME, ".agents", "skills")]
  },
  augment: {
    name: "Augment",
    format: "rules-md",
    roots: [path.join(HOME, ".augment")],
    dirs: [path.join(HOME, ".augment", "skills")]
  },
  amazonq: {
    name: "Amazon Q",
    format: "rules-md",
    roots: [path.join(HOME, ".amazonq"), path.join(HOME, ".aws", "amazonq")],
    dirs: [path.join(HOME, ".amazonq", "skills"), path.join(HOME, ".aws", "amazonq", "skills")]
  },
  jetbrains: {
    name: "JetBrains AI",
    format: "skill",
    roots: [path.join(HOME, ".junie")],
    dirs: [path.join(HOME, ".junie", "skills")]
  }
};

function readSource(skillDir) {
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new Error(`no SKILL.md at ${skillMd}`);
  }
  const raw = fs.readFileSync(skillMd, "utf8");
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const body = fm ? raw.slice(fm[0].length) : raw;
  const descMatch = fm && fm[1].match(/^description:\s*(.+)$/m);
  const description = descMatch ? descMatch[1].trim().replace(/^['"]|['"]$/g, "") : SKILL_NAME;
  return { body, description };
}

function getFrontmatter(key, description) {
  const d = description.replace(/'/g, "''");
  const base = `name: ${SKILL_NAME}\ndescription: '${d}'\nlicense: Proprietary`;
  switch (key) {
    case "aider":
      return ""; // Aider uses plain markdown, no frontmatter
    case "opencode":
      return `---\n${base}\ncompatibility: opencode\n---\n\n`;
    case "cursor":
      return `---\n${base}\nglobs: ["**/*.{html,css,js,ts,jsx,tsx,vue,svelte,astro,md}"]\nalwaysApply: true\n---\n\n`;
    case "claude":
      return `---\n${base}\nversion: 1.0.0\n---\n\n`;
    case "copilot":
      return `---\n${base}\napplyTo: "**/*"\n---\n\n`;
    case "windsurf":
    case "codium":
      return `---\n${base}\ntrigger: always_on\n---\n\n`;
    case "cody":
      return `---\n${base}\n---\n\n`;
    case "continue":
      return `---\n${base}\nglobs: "**/*"\n---\n\n`;
    case "codex":
      return `---\n${base}\nmetadata:\n  short-description: Build and sell high-converting websites\n---\n\n`;
    case "roo":
    case "cline":
    case "jetbrains":
      return `---\n${base}\nversion: 1.0.0\n---\n\n`;
    case "augment":
    case "amazonq":
      return `---\n${base}\n---\n\n`;
    default:
      return `---\n${base}\n---\n\n`;
  }
}

function pickDir(agent) {
  for (const d of agent.dirs) {
    if (fs.existsSync(d)) return d;
  }
  return agent.dirs[0];
}

// agentRoot: the agent's home (dir containing skills/ or rules/), derived from a skills dir
function agentRootOf(skillsDir) {
  return path.basename(skillsDir) === "skills" ? path.dirname(skillsDir) : skillsDir;
}

function destFor(key, agent) {
  if (flags.dir) {
    const payloadDir = path.join(path.resolve(flags.dir), SKILL_NAME);
    return { payloadDir, mainFile: path.join(payloadDir, "SKILL.md") };
  }
  const base = pickDir(agent);
  const payloadDir = path.join(base, SKILL_NAME);
  const root = agentRootOf(base);
  switch (agent.format) {
    case "skill":
      return { payloadDir, mainFile: path.join(payloadDir, "SKILL.md") };
    case "skill-lower":
      return { payloadDir, mainFile: path.join(payloadDir, "skill.md") };
    case "rules-mdc":
      return { payloadDir, mainFile: path.join(root, "rules", `${SKILL_NAME}.mdc`) };
    case "rules-md":
      return { payloadDir, mainFile: path.join(root, "rules", `${SKILL_NAME}.md`) };
    case "conventions":
      return { payloadDir, mainFile: path.join(base, "CONVENTIONS.md") };
    default:
      return { payloadDir, mainFile: path.join(payloadDir, "SKILL.md") };
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function installPayload(payloadDir, skillDir) {
  copyRecursive(path.join(skillDir, "references"), path.join(payloadDir, "references"));
  copyRecursive(path.join(skillDir, "templates"), path.join(payloadDir, "templates"));
  if (fs.existsSync(path.join(skillDir, "departments"))) {
    copyRecursive(path.join(skillDir, "departments"), path.join(payloadDir, "departments"));
  }
}

/* ------------------------------ slash commands ------------------------------ */
// Installed globally for opencode (~/.config/opencode/command/) and Claude Code
// (~/.claude/commands/). Each full-name command file (agentic-web-developer-<slug>.md)
// also gets a short alias (awd-<slug>.md) derived from the filename.

const COMMANDS = {
  opencode: {
    name: "OpenCode",
    // fallback order: last entry wins when none exists — prefer ~/.config/opencode/command
    dirs: [
      path.join(HOME, ".opencode", "command"),
      path.join(HOME, ".config", "opencode", "command")
    ]
  },
  claude: {
    name: "Claude Code",
    // Claude Code reads user commands from ~/.claude/commands
    dirs: [path.join(HOME, ".claude", "commands")]
  }
};

// commands/ lives next to the skill folder (repo root) or inside it.
function resolveCommandsSource(skillDir) {
  const nested = path.join(skillDir, "commands");
  if (fs.existsSync(nested)) return nested;
  const sibling = path.join(path.dirname(skillDir), "commands");
  if (fs.existsSync(sibling)) return sibling;
  return null;
}

function pickCommandDir(cmd) {
  for (const d of cmd.dirs) {
    if (fs.existsSync(d)) return d;
  }
  return cmd.dirs[cmd.dirs.length - 1];
}

function commandDestPaths(key) {
  if (flags.dir) {
    return { dir: path.join(path.resolve(flags.dir), "commands") };
  }
  const cmd = COMMANDS[key];
  if (!cmd) return null;
  return { dir: pickCommandDir(cmd) };
}

// Writes every command file + derived awd-* alias. Returns written/skipped counts.
function installCommands(skillDir, key) {
  const spec = commandDestPaths(key);
  if (!spec) return null;
  const src = resolveCommandsSource(skillDir);
  if (!src) return null;

  let written = 0;
  let skipped = 0;
  if (flags["dry-run"]) {
    const names = fs.readdirSync(src).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
    const all = names.flatMap((n) =>
      n.startsWith(`${SKILL_NAME}-`) ? [n, `awd-${n.slice(SKILL_NAME.length + 1)}`] : [n]
    );
    console.log(`          cmds: ${spec.dir}{/${all.join(", /")}}`);
    return { dir: spec.dir, written: 0, skipped: all.length, dryRun: true };
  }

  fs.mkdirSync(spec.dir, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (!entry.endsWith(".md")) continue;
    const base = entry.replace(/\.md$/, "");
    const targets = [entry];
    if (base.startsWith(`${SKILL_NAME}-`)) {
      targets.push(`awd-${base.slice(SKILL_NAME.length + 1)}.md`);
    }
    const body = fs.readFileSync(path.join(src, entry), "utf8");
    for (const t of targets) {
      const dest = path.join(spec.dir, t);
      if (fs.existsSync(dest) && !flags.force) {
        skipped++;
        continue;
      }
      fs.writeFileSync(dest, body);
      written++;
    }
  }
  return { dir: spec.dir, written, skipped, dryRun: false };
}

/* ------------------------- license config (the gate) ----------------------- */

function licenseFlagsPresent() {
  return Boolean(flags["license-key"] || flags["admin-email"] || flags["admin-secret"]);
}

function validateLicenseFlags() {
  const key = flags["license-key"];
  const adminEmail = flags["admin-email"];
  const adminSecret = flags["admin-secret"];
  if (key && (adminEmail || adminSecret)) {
    throw new Error("--license-key cannot be combined with --admin-email/--admin-secret");
  }
  if ((adminEmail && !adminSecret) || (!adminEmail && adminSecret)) {
    throw new Error("--admin-email and --admin-secret must be provided together");
  }
}

// Writes animotion-config.json into the installed skill folder — the file the
// agentic-web-developer license gate reads (skill dir first, then its parent,
// ~/.animotion-skills/, AGENTIC_LICENSE_CONFIG).
function writeLicenseConfig(payloadDir) {
  if (!licenseFlagsPresent()) return null;
  const cfg = flags["admin-email"]
    ? { tier: "pro", requiredPlan: "pro", authMethod: "admin", adminEmail: flags["admin-email"], adminSecret: flags["admin-secret"] }
    : { tier: "pro", requiredPlan: "pro", authMethod: "license", licenseKey: flags["license-key"] };
  const file = path.join(payloadDir, "animotion-config.json");
  fs.mkdirSync(payloadDir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
  try { fs.chmodSync(file, 0o600); } catch { /* best-effort; Windows ignores */ }
  return file;
}

/* ---------------- skill source resolution (private fetch) ---------------- */

function expandHome(p) {
  if (p === "~") return HOME;
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(HOME, p.slice(2));
  return p;
}

// Find the folder holding SKILL.md inside an extracted/downloaded tree.
// Accepts: the skill folder itself, a folder containing skill/, or an
// archive whose repo root is the skill (depth <= 3).
function findSkillRoot(root, depth) {
  if (fs.existsSync(path.join(root, "SKILL.md"))) return root;
  const nested = path.join(root, "skill");
  if (fs.existsSync(path.join(nested, "SKILL.md"))) return nested;
  if (depth >= 3) return null;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const found = findSkillRoot(path.join(root, e.name), depth + 1);
    if (found) return found;
  }
  return null;
}

function extractArchive(file) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "awd-src-"));
  const args = /\.zip$/i.test(file) ? ["-xf", file, "-C", work] : ["-xzf", file, "-C", work];
  try {
    execFileSync("tar", args, { stdio: "pipe" });
  } catch (e) {
    throw new Error(
      `could not extract ${path.basename(file)} with tar (tar must be on PATH; use a .tar.gz archive — raw: ${e.message})`
    );
  }
  return work;
}

async function downloadTo(url, label) {
  const headers = {
    "User-Agent": "agentic-web-developer-installer",
    Accept: "application/octet-stream, */*"
  };
  const isGithub = /github\.com|githubusercontent\.com/i.test(url);
  const token = flags.token || process.env.AWD_TOKEN || (isGithub ? process.env.GITHUB_TOKEN : undefined);
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { headers, redirect: "follow" });
  } catch (e) {
    throw new Error(`${label}: network error fetching skill source — ${e.message}`);
  }
  if (!res.ok) {
    const hint =
      res.status === 404 || res.status === 403 || res.status === 401
        ? " (private source? add --token=<key> or AWD_TOKEN=<key>)"
        : "";
    throw new Error(`${label}: download failed — HTTP ${res.status} ${res.statusText}${hint}`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-dl-"));
  const name = (url.split("?")[0].split("/").pop() || "source").replace(/[^A-Za-z0-9._-]/g, "_");
  const file = path.join(dir, name.includes(".") ? name : `${name}.tar.gz`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function resolveLocation(loc, label) {
  if (/^https?:\/\//i.test(loc)) {
    console.log(`skill source (${label}): ${loc}`);
    const file = await downloadTo(loc, label);
    const root = findSkillRoot(extractArchive(file), 0);
    if (!root) throw new Error(`${label}: the downloaded archive contains no SKILL.md — does the source contain the skill/ folder?`);
    return root;
  }

  const p = path.resolve(expandHome(loc));
  if (!fs.existsSync(p)) return null;
  if (fs.statSync(p).isDirectory()) {
    const root = findSkillRoot(p, 0);
    if (!root) throw new Error(`${label}: no SKILL.md found under ${p}`);
    return root;
  }
  const root = findSkillRoot(extractArchive(p), 0);
  if (!root) throw new Error(`${label}: the archive contains no SKILL.md`);
  return root;
}

function readPkg() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

async function resolveSource() {
  // 1. explicit flag
  if (flags.source) {
    const r = await resolveLocation(String(flags.source), "--source");
    if (!r) throw new Error(`--source: no such file or directory: ${flags.source}`);
    return r;
  }
  // 2. environment
  if (process.env.AWD_SOURCE) {
    const r = await resolveLocation(process.env.AWD_SOURCE, "AWD_SOURCE");
    if (!r) throw new Error(`AWD_SOURCE: no such file or directory: ${process.env.AWD_SOURCE}`);
    return r;
  }
  // 3. local development checkout (skill/ next to bin/)
  if (fs.existsSync(path.join(BUNDLED_SKILL, "SKILL.md"))) return BUNDLED_SKILL;
  // 4. source configured by the package author
  const pkg = readPkg();
  const pkgSource = pkg && pkg.awd && pkg.awd.source;
  if (pkgSource) {
    const r = await resolveLocation(String(pkgSource), "package.json awd.source");
    if (r) return r;
    throw new Error(`package.json awd.source could not be resolved: ${pkgSource}`);
  }
  throw new Error(
    [
      "no skill source found — this npm package ships only the installer (+ docs).",
      "Provide the skill payload with one of:",
      "  --source=<url|path>        a .tar.gz/.zip URL, or a local skill folder/archive",
      "  AWD_SOURCE=<url|path>      same, via environment variable",
      "  awd.source in package.json set by the package author before publishing",
      "Private sources also need a token: --token=<key> or AWD_TOKEN=<key>",
      "Local development: keep the skill/ folder next to bin/ — it is used automatically."
    ].join("\n")
  );
}

/* -------------------------------- commands -------------------------------- */

function detect() {
  console.log(`\nAgents on this machine (and ${SKILL_NAME} install status):\n`);
  let found = 0;
  for (const [key, agent] of Object.entries(AGENTS)) {
    const present = agent.roots.some((r) => fs.existsSync(r));
    const { mainFile, payloadDir } = destFor(key, agent);
    let installed = fs.existsSync(mainFile);
    // Aider's CONVENTIONS.md may belong to another skill — require our marker
    if (installed && agent.format === "conventions") {
      installed = fs.readFileSync(mainFile, "utf8").includes(MARKER);
    }
    if (installed && !fs.existsSync(payloadDir)) installed = false;
    if (present) found++;
    let status = installed ? "INSTALLED" : present ? "not installed" : "agent not found";
    // slash commands (opencode + claude only)
    let cmdNote = "";
    if (COMMANDS[key]) {
      const dir = pickCommandDir(COMMANDS[key]);
      const mainCmd = path.join(dir, `${SKILL_NAME}.md`);
      const aliasCmd = path.join(dir, "awd-strategy.md");
      if (fs.existsSync(mainCmd) || fs.existsSync(aliasCmd)) {
        cmdNote = `  cmds: ${dir}`;
      } else if (installed) {
        cmdNote = "  cmds: not installed";
      }
    }
    console.log(
      `  ${present || installed ? "*" : " "} ${key.padEnd(10)} ${agent.name.padEnd(20)} ${status}` +
        (installed ? `  -> ${mainFile}` : "") +
        cmdNote
    );
  }
  console.log(`\n  Install: npx ${SKILL_NAME} install --agent=<key>   (or --all, or omit --agent for auto)\n`);
  return found;
}

async function install() {
  validateLicenseFlags();
  const skillDir = await resolveSource();
  const { body, description } = readSource(skillDir);

  let keys;
  if (flags.agent === "all") {
    keys = Object.keys(AGENTS);
  } else if (flags.agent) {
    if (!AGENTS[flags.agent]) {
      throw new Error(`unknown agent "${flags.agent}". Valid keys: ${Object.keys(AGENTS).join(", ")}, all`);
    }
    keys = [flags.agent];
  } else if (flags.all) {
    keys = Object.keys(AGENTS);
  } else {
    // auto: opencode first, then claude, then any detected agent
    const detected = Object.entries(AGENTS).filter(([, a]) => a.roots.some((r) => fs.existsSync(r)));
    const preferred = ["opencode", "claude"].filter((k) => detected.some(([dk]) => dk === k));
    keys = [preferred[0] || (detected[0] && detected[0][0]) || "opencode"];
  }

  let done = 0;
  for (const key of keys) {
    const agent = AGENTS[key];
    const { payloadDir, mainFile } = destFor(key, agent);
    const isRuleFile = ["rules-mdc", "rules-md", "conventions"].includes(agent.format);

    if (flags["dry-run"]) {
      console.log(`[dry-run] ${agent.name} (${key})`);
      console.log(`          main: ${mainFile}`);
      console.log(`          refs: ${payloadDir}{/references, /templates, /departments}`);
      if (licenseFlagsPresent()) console.log(`          lic:  ${path.join(payloadDir, "animotion-config.json")}`);
      if (!flags["no-commands"]) installCommands(skillDir, key);
      done++;
      continue;
    }

    if (fs.existsSync(mainFile) && !flags.force) {
      if (agent.format === "conventions") {
        const existing = fs.readFileSync(mainFile, "utf8");
        if (!existing.includes(MARKER)) {
          console.log(`skip ${agent.name}: ${mainFile} already exists and was not written by this installer (use --force to overwrite)`);
          continue;
        }
      }
      console.log(`skip ${agent.name}: already installed at ${mainFile} (use --force to overwrite)`);
      const existingCfg = writeLicenseConfig(payloadDir);
      if (existingCfg) console.log(`  license config: ${existingCfg}`);
      if (!flags["no-commands"]) {
        const cmds = installCommands(skillDir, key);
        if (cmds && !cmds.dryRun) {
          console.log(`  commands: ${cmds.written} written, ${cmds.skipped} kept -> ${cmds.dir}`);
        }
      }
      continue;
    }

    fs.mkdirSync(payloadDir, { recursive: true });
    installPayload(payloadDir, skillDir);

    // Frontmatter per agent; rule files get a pointer to the reference payload
    let content = getFrontmatter(key, description) + body;
    if (isRuleFile) {
      const pointer = `> Reference playbooks: ${path.join(payloadDir, "references")} — templates: ${path.join(payloadDir, "templates")}\n\n`;
      const fm = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n\n/);
      if (fm) {
        content = fm[0] + pointer + content.slice(fm[0].length);
      } else {
        content = `${MARKER}\n${pointer}${content}`;
      }
    }
    fs.mkdirSync(path.dirname(mainFile), { recursive: true });
    fs.writeFileSync(mainFile, content);
    const cfgFile = writeLicenseConfig(payloadDir);
    console.log(`installed ${agent.name} (${key})`);
    console.log(`  main: ${mainFile}`);
    console.log(`  refs: ${payloadDir}`);
    if (cfgFile) console.log(`  license config: ${cfgFile}`);
    if (!flags["no-commands"]) {
      const cmds = installCommands(skillDir, key);
      if (cmds && !cmds.dryRun) {
        console.log(`  commands: ${cmds.written} written, ${cmds.skipped} kept -> ${cmds.dir}`);
      }
    }
    done++;
  }

  if (!done) {
    console.log("nothing installed — everything already present (use --force to overwrite)");
  } else if (!flags["dry-run"]) {
    if (licenseFlagsPresent()) {
      console.log("\nLicense saved — the skill's gate reads animotion-config.json automatically.");
    }
    console.log(`\nDone. Restart your AI agent so it loads ${SKILL_NAME}.`);
    console.log("Animations for any site built with this skill are handled by the AnimotionJS agentic skill:");
    console.log("  npx animotion-skills install --tier=agentic --agent=<agent> --license-key=YOUR_KEY");
  }
}

switch (command) {
  case "detect":
    detect();
    break;
  case "install":
    install().catch((err) => {
      console.error(`error: ${err.message}`);
      process.exit(1);
    });
    break;
  case "help":
  case "--help":
    usage();
    break;
  default:
    usage();
    process.exit(1);
}

function usage() {
  console.log(`
${SKILL_NAME} — install the agentic-web-developer skill into your AI agent

Usage:
  npx ${SKILL_NAME} install [options]
  npx ${SKILL_NAME} detect

Options:
  --agent=<key>   Target one agent: ${Object.keys(AGENTS).join(", ")}
  --agent=all     Target every supported agent
  --all           Same as --agent=all
  --source=<s>    Skill source: a .tar.gz/.zip URL or a local folder/archive
                  (falls back to AWD_SOURCE, then skill/, then awd.source)
  --token=<key>   Auth token for a private source (or AWD_TOKEN=<key>)
  --license-key=<key>
                  Save your Pro license key to the installed skill
                  (writes animotion-config.json the license gate reads)
  --admin-email=<e> --admin-secret=<s>
                  Admin credentials instead of a key (Animotion staff /
                  whitelisted emails only — both flags required together)
  --force         Overwrite an existing install
  --dry-run       Print target paths without copying
  --dir=<path>    Install into <path>/${SKILL_NAME} (flat, SKILL.md layout)
  --home=<path>   Use <path> as the home directory (testing)
  --no-commands   Skip installing the slash commands (/agentic-web-developer-* + /awd-*)

Skill source order: --source > AWD_SOURCE > ./skill > package.json awd.source
The npm package ships only this installer (+ docs) — never the skill source.

Slash commands (opencode + claude, unless --no-commands):
  /agentic-web-developer                     router (starts at Strategy)
  /agentic-web-developer-<dept>              full name per department
  /awd-<dept>                                short alias (strategy, research, content,
                                             design, frontend, backend, motion, qa,
                                             deploy, launch, growth)
  /awd-<dept> <stage>                        stage jump (e.g. /awd-design 4.3)
  /awd-list                                  print every department + stage; start anywhere
  /awd-taste                                 taste training (not a department —
                                             builds/edits your taste profile any time)
  -> opencode: ~/.config/opencode/command/   claude: ~/.claude/commands/

Each agent gets its own file format:
  skill agents (opencode, claude, copilot, cody, codex, roo, cline, jetbrains)
                            -> <skills>/${SKILL_NAME}/SKILL.md
  windsurf, codium          -> <skills>/${SKILL_NAME}/skill.md
  cursor                    -> ~/.cursor/rules/${SKILL_NAME}.mdc
  continue                  -> ~/.continue/rules/${SKILL_NAME}.md
  augment                   -> ~/.augment/rules/${SKILL_NAME}.md
  amazonq                   -> ~/.amazonq/rules/${SKILL_NAME}.md
  aider                     -> ~/.aider/skills/CONVENTIONS.md

Examples:
  npx ${SKILL_NAME} install                                # auto-detect agent
  npx ${SKILL_NAME} install --agent=opencode --license-key=sec_live_xxxxxxxx
  npx ${SKILL_NAME} install --agent=all --source=https://you/server/skill.tar.gz --token=KEY
  npx ${SKILL_NAME} detect
`);
}
