# agentic-web-developer

An **agentic skill** that turns an AI coding agent into a complete web-development and website-selling system

Plus a **novel-idea / product-launch mode** for websites not covered by the videos (SaaS, products, marketplaces).

And a **Mode C** for advanced 3D / WebGL sites — cinematic Three.js builds in the style of Kage and Towers.

> **Licensed — Pro plan ($7/month).** The skill validates an Animotion **Pro key** (or staff admin credentials) once per session before doing any work. [![Get Pro — $7/mo](https://img.shields.io/badge/Get_Pro-%247%2Fmonth-38ED26)](https://skills.animotion.click/checkout?plan=pro) [![Get Studio — $15/mo](https://img.shields.io/badge/Get_Studio-%2415%2Fmonth-222222)](https://skills.animotion.click/checkout?plan=studio) — payment steps, install-with-key commands and credential setup: **[License & unlocking](#license--unlocking-the-skill)** · full guide **[docs/LICENSING.md](docs/LICENSING.md)**.

## What you get

- **Stage-gated pipeline** (Intake → Niche → Research → Design → Build → QA → Animation handoff → Deploy → Sell) where the agent **asks for your input at every step** — it never runs ahead on assumptions.
- **Three modes** — Mode A build-and-sell, Mode B novel idea / product launch, Mode C advanced 3D / WebGL experience.
- **Design-tool agnostic** — Figma, Paper, Google Stitch, Google AI Studio, Framer or code-first. You supply the credentials/MCP for your tool of choice.
- **Framework agnostic** — Next.js, React, Vue, Svelte, Astro, plain HTML, WordPress, GoHighLevel — you pick.
- **All animation is delegated** to the [AnimotionJS agentic skill](https://skills.animotion.click/checkout) — this skill never writes animation code itself.
- 11 reference playbooks + 5 ready-to-fill templates (builder brief, scaffold HTML, `siteconfig.ts`, outlier anatomy, 3D scene brief).

## Install

Full guide (per-agent paths, manual install, uninstall): **[docs/INSTALL.md](docs/INSTALL.md)** — worked examples of both modes: **[docs/EXAMPLES.md](docs/EXAMPLES.md)**.

```bash
# auto-detect your agent (opencode → claude → any detected agent)
npx agentic-web-developer install

# or target one of the 15 supported agents
npx agentic-web-developer install --agent=opencode
npx agentic-web-developer install --agent=claude

# or install for every detected agent at once
npx agentic-web-developer install --all

# see what's installed where
npx agentic-web-developer detect
```

Other flags: `--force` (overwrite), `--dry-run` (print targets only), `--dir=<path>` (custom destination), `--source=<url|path>` / `--token=<key>` (skill source).

Then **restart your AI agent** so it loads the skill.

> **On first run the skill asks for its Pro license key** (or admin credentials) and validates it once per session — see [License & unlocking](#license--unlocking-the-skill) before you start a project.

> **Where does the skill come from?** Not from npm — the package ships only the installer and docs. The installer fetches the skill from a source you configure (`--source`, `AWD_SOURCE`, or the author's `awd.source` in `package.json`). See [docs/INSTALL.md § Skill source](docs/INSTALL.md#skill-source).

### Supported agents

`opencode` · `claude` · `copilot` · `cursor` · `windsurf` · `codex` · `cline` · `roo` · `cody` · `codium` · `aider` · `continue` · `augment` · `amazonq` · `jetbrains`

The installer writes **each agent's own file format** with the right frontmatter — `SKILL.md` for skill agents, `skill.md` for Windsurf/Codium, `rules/*.mdc` for Cursor, `rules/*.md` for Continue/Augment/Amazon Q, `CONVENTIONS.md` for Aider — and puts the `references/` + `templates/` payload where that agent can read it. Same 15 agents as the AnimotionJS skill.

### Manual install (no CLI)

See **[docs/INSTALL.md](docs/INSTALL.md#manual-install-no-cli)** — per-agent copy instructions for all 15 agents.

## License & unlocking the skill

The skill ships behind the **Animotion Pro plan — $7/month**. One validation per session (cached 7 days) runs before any pipeline work; without it the skill refuses to start.

### How to pay for Pro

1. **Click a Get Pro button** (top of this README or above) — opens [`skills.animotion.click/checkout?plan=pro`](https://skills.animotion.click/checkout?plan=pro) with Pro preselected ($7/month). Studio ($15/month) also unlocks this skill *and* the AnimotionJS animation skill you need at Stage 8.
2. **Enter your email** — the license is tied to it.
3. **Continue to Payment** → Stripe's hosted checkout (card).
4. **Confirm** — monthly, cancel anytime.
5. **Copy your key** (`sec_live_…`) from the confirmation page.

### How to give the skill your key (or admin credentials)

Pick one — the gate checks them in this order:

**1. Environment variable (recommended)**

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
export AGENTIC_LICENSE_KEY="sec_live_xxxxxxxx"
```

```powershell
# PowerShell — persistent (open a new terminal afterwards)
setx AGENTIC_LICENSE_KEY "sec_live_xxxxxxxx"
```

`ANIMOTION_LICENSE_KEY` works as an alias — one variable serves this skill and the Animotion installer.

**2. `animotion-config.json`** — the file the Animotion installer writes (next to the installed skill, its parent dir, `~/.animotion-skills/`, or the path in `AGENTIC_LICENSE_CONFIG`):

```json
{
  "tier": "pro",
  "requiredPlan": "pro",
  "authMethod": "license",
  "licenseKey": "sec_live_xxxxxxxx"
}
```

**3. Admin credentials (Animotion staff / whitelisted emails only)** — env vars `AGENTIC_ADMIN_EMAIL` + `AGENTIC_ADMIN_SECRET`, or a config file with `"authMethod": "admin"` and `adminEmail` / `adminSecret`. Never commit these; everyone else should use a personal Pro key.

**4. Ask in-session** — with nothing found, the skill asks once (via its question tool); paste the key and it validates immediately.

### What happens at runtime

The skill calls `POST https://skills.animotion.click/api/license/validate` with `{ "skill": "agentic-web-developer", "plan": "pro" }` and your key (or admin pair). On success the verdict is cached at `~/.animotion-skills/cache/agentic-web-developer-verdict.json` for 7 days; offline sessions reuse a fresh cache. Full troubleshooting (invalid key, wrong plan, expired cache, local dev server): **[docs/LICENSING.md](docs/LICENSING.md)**.

You can also download the skill files directly with your key or admin pair — copy-paste commands in [docs/LICENSING.md § Install the skill files](docs/LICENSING.md#install-the-skill-files-license-key-or-admin-credentials).

## Animations are a separate skill (required to finish a site)

Every website built with this skill gets its **animations and interactions from the AnimotionJS agentic skill** — hero reveals, scroll effects, hover states, counters, parallax, text FX. Install it too:

```bash
npx animotion-skills install --tier=agentic --agent=<your-agent> --license-key=YOUR_KEY
# or for all detected agents:
npx animotion-skills install --tier=agentic --all --license-key=YOUR_KEY
```

- License key (Studio plan, $15/month): https://skills.animotion.click/checkout
- Local source on the author's machine: `C:\Users\creat\Projects\Animotionjs\animotion-skills`

Without it, the skill will still design and build — but it will stop at Stage 8 and ask you to install Animotion before any motion work.

## Using the skill

Just talk to your agent:

> "Build me a website that converts for my pool cleaning business"
> "Launch a product website for my new SaaS idea"
> "Build me an immersive 3D website"
> "Use the agentic-web-developer skill"

The agent classifies the project (Mode A: build-and-sell, Mode B: novel idea, Mode C: advanced 3D/WebGL), then walks you through every gate.

## Project layout

```
agentic-web-developer/
├── package.json          # npm manifest (bin: agentic-web-developer, awd.source)
├── bin/install.js        # zero-dependency installer CLI (all 15 agents, per-agent formats)
├── skill/                # ← the skill itself (source of truth; never published)
│   ├── SKILL.md
│   ├── references/       # 11 playbooks (incl. licensing.md)
│   └── templates/        # 5 fill-in templates (incl. 3D scene brief)
├── docs/                 # ← the only content tracked in Git
│   ├── INSTALL.md        # install guide for all 15 agents
│   ├── EXAMPLES.md       # worked walkthroughs: Mode A + Mode B
│   └── LICENSING.md      # Pro plan, payment steps, key/admin credentials
└── README.md             # ← tracked in Git
```

> **Git vs npm vs skill source — nothing public carries your source:**
> - **Git:** only `README.md` and `docs/` are visible (`.gitignore` hides the rest).
> - **npm:** only the installer + docs are published (npm tarballs are public forever, so `skill/` is excluded) — set `awd.source` in `package.json` before publishing.
> - **Skill source:** `skill/` is fetched by the installer from the URL/path you configure (`--source`, `AWD_SOURCE`, or `awd.source`), with `--token`/`AWD_TOKEN` for private hosts.

## Development

Edit files under `skill/`, then refresh your local opencode install:

```bash
node bin/install.js install --agent=opencode --force
```

Check the package contents before publishing:

```bash
npm run pack:check
```

## Publishing to npm

```bash
# 1. point the installer at your private skill source first (never published to npm)
#    edit package.json -> "awd": { "source": "https://api.github.com/repos/YOU/REPO/tarball/main" }
#    (end users pass the token: AWD_TOKEN=... npx agentic-web-developer install)

npm login                # once, with your npm account
npm publish              # publishes bin + docs only (publishConfig.access = "public")
```

Bump `version` in `package.json` for every update, then `npm publish` again.

## License

UNLICENSED — all rights reserved by the author. Replace the `license` field in `package.json` and add a LICENSE file if you intend to distribute it under a specific license.
