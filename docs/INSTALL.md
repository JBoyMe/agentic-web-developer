# Installing agentic-web-developer

The skill installs into **15 AI coding agents** — the same 15 the AnimotionJS skill supports. The installer writes each agent's own file format (`SKILL.md`, `skill.md`, a rules file, or `CONVENTIONS.md`) with the right frontmatter, plus the reference playbooks and templates alongside it.

> **The npm package contains only the installer and these docs** — never the skill source. The installer fetches the skill payload from a *skill source* you configure (see [Skill source](#skill-source)).

## Quick start

```bash
# auto-detect your agent (opencode -> claude -> any detected agent)
npx agentic-web-developer install

# target one agent by key
npx agentic-web-developer install --agent=claude

# install for every supported agent at once
npx agentic-web-developer install --all

# see what's installed, and where
npx agentic-web-developer detect
```

Then **restart your AI agent** so it loads the skill.

### All flags

| Flag | Effect |
|---|---|
| `--agent=<key>` | Install for one agent (keys in the table below) |
| `--agent=all` / `--all` | Install for all 15 agents |
| `--source=<url\|path>` | Skill source: a `.tar.gz`/`.zip` URL, or a local skill folder/archive |
| `--token=<key>` | Auth token for a private source (else `AWD_TOKEN`) |
| `--force` | Overwrite an existing install |
| `--dry-run` | Print the target paths without writing anything |
| `--dir=<path>` | Install flat into `<path>/agentic-web-developer/` (SKILL.md layout) |
| `--home=<path>` | Use `<path>` as the home directory (for testing) |

## Skill source

Because the npm tarball ships no `skill/` folder, the installer resolves the payload from the first available source, in this order:

1. `--source=<url|path>` — explicit flag
2. `AWD_SOURCE=<url|path>` — environment variable
3. `skill/` next to `bin/` — local development checkout (used automatically)
4. `awd.source` in `package.json` — set by the package author before publishing

**URL sources** are downloaded and extracted (system `tar`; `.tar.gz` preferred, `.zip` works on Windows/macOS). The archive may be the repo root, a `skill/` folder inside it, or anything containing `SKILL.md` within three levels.

**Private sources** need a token: `--token=<key>` or `AWD_TOKEN=<key>` (`GITHUB_TOKEN` is used automatically for github.com URLs):

```bash
# private GitHub repo (tarball API)
npx agentic-web-developer install --source=https://api.github.com/repos/YOU/private-skill/tarball/main --token=ghp_XXXX

# same, via environment (handy for CI or shell profiles)
export AWD_SOURCE=https://api.github.com/repos/YOU/private-skill/tarball/main
export AWD_TOKEN=ghp_XXXX
npx agentic-web-developer install

# your own server / object storage
npx agentic-web-developer install --source=https://your-server/skill.tar.gz

# local folder or archive (no network)
npx agentic-web-developer install --source=~/backups/skill
```

The package author normally sets `awd.source` in `package.json` once, so end users just run `npx agentic-web-developer install` with no configuration.

## Where each agent gets the skill

| Key | Agent | File written | Plus |
|---|---|---|---|
| `opencode` | OpenCode | `~/.config/opencode/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `claude` | Claude Code | `~/.claude/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `copilot` | GitHub Copilot | `%APPDATA%\github-copilot\skills\agentic-web-developer\SKILL.md` | `references/`, `templates/` |
| `cursor` | Cursor | `~/.cursor/rules/agentic-web-developer.mdc` | payload in `~/.cursor/skills/agentic-web-developer/` |
| `windsurf` | Windsurf (Codeium) | `~/.codeium/windsurf/skills/agentic-web-developer/skill.md` | `references/`, `templates/` |
| `cody` | Cody (Sourcegraph) | `~/.cody/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `codium` | Codium | `~/.codium/skills/agentic-web-developer/skill.md` | `references/`, `templates/` |
| `aider` | Aider | `~/.aider/skills/CONVENTIONS.md` | payload in `~/.aider/skills/agentic-web-developer/` |
| `continue` | Continue | `~/.continue/rules/agentic-web-developer.md` | payload in `~/.continue/skills/agentic-web-developer/` |
| `codex` | Codex (OpenAI) | `~/.codex/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `roo` | Roo Code | `~/.roo/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `cline` | Cline | `~/.cline/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |
| `augment` | Augment | `~/.augment/rules/agentic-web-developer.md` | payload in `~/.augment/skills/agentic-web-developer/` |
| `amazonq` | Amazon Q | `~/.amazonq/rules/agentic-web-developer.md` | payload in `~/.amazonq/skills/agentic-web-developer/` |
| `jetbrains` | JetBrains AI | `~/.junie/skills/agentic-web-developer/SKILL.md` | `references/`, `templates/` |

Notes:

- **Rules agents** (cursor, continue, augment, amazonq) receive the full skill body as a rules file with agent-specific frontmatter (`globs`, `alwaysApply`, `trigger`, …). The file starts with a pointer to the installed `references/` and `templates/` payload so the agent can read the playbooks on demand.
- **Aider** has no skill loader — it reads conventions files. The skill lands at `~/.aider/skills/CONVENTIONS.md`. Point Aider at it with `aider --read ~/.aider/skills/CONVENTIONS.md`, or copy that file into a project as `CONVENTIONS.md`. The installer never overwrites a `CONVENTIONS.md` it didn't write (unless you pass `--force`), so an existing Animotion or other conventions file is safe.
- Windows paths are shown with `~` for your user home; `%APPDATA%` is your Roaming app-data folder.

## Manual install (no CLI)

Get the skill folder itself (the package doesn't contain it — take it from your configured source, or a copy someone sent you), then place the files as the table above says:

- **SKILL.md agents** — copy the `skill/` folder to `<skills-dir>/agentic-web-developer/` (it must contain `SKILL.md`, `references/`, `templates/`).
- **Windsurf / Codium** — same, but rename `SKILL.md` to `skill.md`.
- **Cursor** — copy `skill/SKILL.md` to `~/.cursor/rules/agentic-web-developer.mdc`, keep `references/` + `templates/` in `~/.cursor/skills/agentic-web-developer/`.
- **Continue / Augment / Amazon Q** — copy `skill/SKILL.md` to the agent's `rules/agentic-web-developer.md` (paths in the table), payload alongside in `skills/agentic-web-developer/`.
- **Aider** — copy `skill/SKILL.md` (without its `---` frontmatter block) to `~/.aider/skills/CONVENTIONS.md`.

## Verify

```bash
npx agentic-web-developer detect
```

`INSTALLED` next to an agent means the skill file and its payload are both in place.

## Uninstall

Delete what the table lists for your agent — the skill file **and** the `agentic-web-developer/` payload folder. For example:

```bash
# opencode
rm -rf ~/.config/opencode/skills/agentic-web-developer

# cursor (rule file + payload)
rm -f ~/.cursor/rules/agentic-web-developer.mdc
rm -rf ~/.cursor/skills/agentic-web-developer
```

## Companion: AnimotionJS (required for animation)

Every site built with this skill gets its **animations from the AnimotionJS agentic skill** — this skill never writes motion code. Install Animotion for the same agent:

```bash
npx animotion-skills install --tier=agentic --agent=<agent> --license-key=YOUR_KEY
npx animotion-skills install --tier=agentic --all --license-key=YOUR_KEY   # every detected agent
npx animotion-skills install --detect
```

- License key (Studio plan, $15/month): https://skills.animotion.click/checkout
- Without a key the build still works up to Stage 8 (animation handoff), where it stops and asks you to install Animotion.

## Repository vs npm package vs skill source

- **This Git repository** contains **documentation only** (`README.md`, `docs/`) — the `.gitignore` hides everything else.
- **The npm package** contains **only the installer** (`bin/install.js`) + docs — never `skill/`. Anything in a published tarball is publicly downloadable forever, so the source stays out of it.
- **The skill source** lives wherever you say: [Skill source](#skill-source) (`--source`, `AWD_SOURCE`, or the author's `awd.source`).

## Examples

Two full scenario walkthroughs — one per mode — are in [EXAMPLES.md](./EXAMPLES.md).
