# agentic-web-developer

An **agentic skill** that turns an AI coding agent into a complete web-development and website-selling system

Plus a **novel-idea / product-launch mode** for websites not covered by the videos (SaaS, products, marketplaces).

And advance 3D animated website.


## What you get

- **Stage-gated pipeline** (Intake → Niche → Research → Design → Build → QA → Animation handoff → Deploy → Sell) where the agent **asks for your input at every step** — it never runs ahead on assumptions.
- **Design-tool agnostic** — Figma, Paper, Google Stitch, Google AI Studio, Framer or code-first. You supply the credentials/MCP for your tool of choice.
- **Framework agnostic** — Next.js, React, Vue, Svelte, Astro, plain HTML, WordPress, GoHighLevel — you pick.
- **All animation is delegated** to the [AnimotionJS agentic skill](https://skills.animotion.click/checkout) — this skill never writes animation code itself.
- 10 reference playbooks + 4 ready-to-fill templates (builder brief, scaffold HTML, `siteconfig.ts`, outlier anatomy).

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

> **Where does the skill come from?** Not from npm — the package ships only the installer and docs. The installer fetches the skill from a source you configure (`--source`, `AWD_SOURCE`, or the author's `awd.source` in `package.json`). See [docs/INSTALL.md § Skill source](docs/INSTALL.md#skill-source).

### Supported agents

`opencode` · `claude` · `copilot` · `cursor` · `windsurf` · `codex` · `cline` · `roo` · `cody` · `codium` · `aider` · `continue` · `augment` · `amazonq` · `jetbrains`

The installer writes **each agent's own file format** with the right frontmatter — `SKILL.md` for skill agents, `skill.md` for Windsurf/Codium, `rules/*.mdc` for Cursor, `rules/*.md` for Continue/Augment/Amazon Q, `CONVENTIONS.md` for Aider — and puts the `references/` + `templates/` payload where that agent can read it. Same 15 agents as the AnimotionJS skill.

### Manual install (no CLI)

See **[docs/INSTALL.md](docs/INSTALL.md#manual-install-no-cli)** — per-agent copy instructions for all 15 agents.

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
> "Use the agentic-web-developer skill"

The agent classifies the project (Mode A: build-and-sell, Mode B: novel idea), then walks you through every gate.

## Project layout

```
agentic-web-developer/
├── package.json          # npm manifest (bin: agentic-web-developer, awd.source)
├── bin/install.js        # zero-dependency installer CLI (all 15 agents, per-agent formats)
├── skill/                # ← the skill itself (source of truth; never published)
│   ├── SKILL.md
│   ├── references/       # 10 playbooks
│   └── templates/        # 4 fill-in templates
├── docs/                 # ← the only content tracked in Git
│   ├── INSTALL.md        # install guide for all 15 agents
│   └── EXAMPLES.md       # worked walkthroughs: Mode A + Mode B
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
