# agentic-web-developer

An **agentic skill** that turns an AI coding agent into a complete web-development and website-selling system — organized as **11 departments** (Strategy → Research → Content → Design → Frontend → Backend → Motion → QA → Deploy → Launch → Growth), each with its own slash command (`/agentic-web-developer-<dept>`, short alias `/awd-<dept>`).

Plus a **novel-idea / product-launch mode** for websites not covered by the videos (SaaS, products, marketplaces).

And a **Mode C** for advanced 3D / WebGL sites — cinematic Three.js builds in the style of Kage and Towers.

Plus a **Mode D** for design-sketch intake — hand over your sketches/wireframes and the skill reads the pages and layouts off them, confirms an inventory, and runs only the departments needed.

And a **Mode E** for template reuse — save any finished project as a reusable template (`/awd-mode-e`), then build new projects from it (`/awd-mode-e-<template-name>`): swap interview, Asset Builder for missing assets, light pipeline (Template plan, $25/month).

Every mode also ships the **Asset Builder** (`/awd-assets`) — audio, video and full 3D generated **inside your session** through managed credits (or your own Renderful key) and local headless Blender, with prepaid generation credits sold separately from every plan.

> **Licensed — Pro plan ($7/month).** The skill validates an Animotion **Pro key** (or staff admin credentials) once per session before doing any work. **Mode E needs the Template plan ($25/month)** instead. [![Get Pro — $7/mo](https://img.shields.io/badge/Get_Pro-%247%2Fmonth-38ED26)](https://skills.animotion.click/checkout?plan=pro) [![Get Studio — $15/mo](https://img.shields.io/badge/Get_Studio-%2415%2Fmonth-222222)](https://skills.animotion.click/checkout?plan=studio) [![Get Template — $25/mo](https://img.shields.io/badge/Get_Template-%2425%2Fmonth-6C2BD9)](https://skills.animotion.click/checkout?plan=template) — payment steps, install-with-key commands and credential setup: **[License & unlocking](#license--unlocking-the-skill)** · full guide **[docs/LICENSING.md](docs/LICENSING.md)**.

## What you get

- **11-department system** — Strategy (intake, mode, validation) · Research (design DNA + competitor intelligence) · Content (all the copy, agent-written) · Design (UI/UX + generated assets) · Frontend (framework, scaffold, build) · Backend (server-side, *only on request*) · Motion (motion brief + AnimotionJS handoff) · Quality Assurance (conversion, a11y, perf, SEO) · Deployment (ship + verify) · Launch (product launch films & logo animations as MP4 via HyperFrames, *on request*) · Growth (launch, outreach, monetization) — **one gate per stage, progress footer on every response**, the agent **never runs ahead on assumptions**.
- **Slash commands + free navigation** — `/awd-strategy`, `/awd-research`, `/awd-content`, `/awd-design`, `/awd-frontend`, `/awd-backend`, `/awd-motion`, `/awd-qa`, `/awd-deploy`, `/awd-launch`, `/awd-growth`, plus **`/awd-list`** (prints every department **and every stage** — start at any department or stage of any project at any time, e.g. `/awd-design 4.3`) and **`/awd-taste`** (taste training — not a department), **`/awd-assets`** (Asset Builder — audio, video, 3D in any mode) and **`/awd-mode-e`** (template save/list; `/awd-mode-e-<template>` to build from a template — Template plan) (full `/agentic-web-developer-*` names and the `/agentic-web-developer` router). Installed globally for **opencode** and **Claude Code**; `--no-commands` to skip.
- **Asset Builder in every mode** — `/awd-assets` (also Design **4.3** and Mode E **E.3**): inventory → route → generate → ingest & QA → control-interaction brief. **Renderful** (through the managed credits proxy by default, or your own key) for image, audio (text → voice/music/SFX, sound-in → transformed audio), video (text/image → video) and 3D base meshes; **local headless Blender (0 credits)** for block-animation video and text/image/video → full 3D with materials + animation. Prepaid generation credits are **separate from every plan** — 1 credit = $0.05 of Renderful spend, packs **100/$7 · 300/$21 · 1,000/$65 · 3,000/$189**; every control interaction is built by the **AnimotionJS Studio tier**. `references/asset-builder.md`, `references/asset-credits.md`, `references/blender-assets.md`.
- **Launch department (on request)** — 15–30s product launch film + 5–8s logo sting rendered to MP4 with HyperFrames: brief → capture & look system → storyboard & build → senior-designer critique loop & render. After Effects-quality motion via the AE → HyperFrames motion dictionary, plus the agency-grade SaaS motion canon (asymmetric ease families, overlapping keyframes, 16-shot library, six brand style packs — Apple/Google/AI/workspace/viral-reel/explainer — distilled from a 164-video SaaS animation playlist); runs in a local agent (needs a shell). `departments/launch.md`, `references/launch-video.md`, `references/saas-animation-craft.md`.
- **Taste training** — users *train* the agent's taste into a global profile (`~/.agentic-web-developer/taste-profile.md`: three dials, point of view, annotated idea archive, ban list). The agent reads it before designing, declares a one-line design read, **always proposes 1–3 gated in-style deviations** over the inspiration (declining = faithful recreation), audits the result 0–100 before approval, and files lasting feedback back into the profile — taste compounds across projects, never assumed.
- **Immersive scroll design (method, Animotion owns the motion)** — an optional scroll-appetite gate at Strategy feeds a full design pass in Design: pick **one of 8 page grammars** (filmic, chaptered, live surface, continuous world, typographic poster, gallery, split stage, cutlist), write a **feeling curve with exactly one engineered peak**, invent a **signature move**, clear a **fingerprint gate** (≥4/6 dimensions differ from your prior builds), and pass taste-floor additions + a layered-hero spec — then Motion turns it into a beat-by-beat **device score table mapped to Animotion commands**, and QA runs a **scroll craft checklist** (contact sheet, dead scroll, cue opacity, frozen media, cold feel check). Scroll-craft's *design method* only; its runtime engine is never shipped. `references/scroll-craft-integration.md`.
- **Project taste file (`brand.md`)** — drop a `brand.md` in the project root and every department reads it before design, copy or asset work: its hard rules (palette, fonts, voice, don'ts) override skill defaults and the taste profile the way a client brand book would. The agent offers to create one at Strategy intake.
- **Intakes explain themselves** — every intake question ships with a *Why* (why it's asked) and an *Example* (a good answer), so you always know what to say next.
- **Five modes** — Mode A build-and-sell, Mode B novel idea / product launch, Mode C advanced 3D / WebGL experience, Mode D design-sketch intake, Mode E template reuse (save a project as a template / build from one, with an Asset Builder for missing assets).
- **Realistic Three.js / WebGL craft** — PBR realism dials, fragment shaders (palettes, noise/fbm, SDFs, dissolve/glitch transitions), particle systems (forces, curl-noise flow fields, GPU `Points`), product viewers/configurators, 3D data viz, React Three Fiber patterns, and a deterministic `?t=N` seek-and-screenshot verify loop — while AnimotionJS still owns every choreographed value. Distills the `3d-visualizer` skill (via explainx.ai) and `webgl-animation-skills`. `references/webgl-interactions.md`.
- **Dev-mode toolkit (opt-in, removable)** — a live CSS styling toolbar plus a prototyping toolbar (hotspots, viewport switcher, grid/measure, states, annotations), gated behind an ask-first question and wrapped in one flag / one marked block so it's fully stripped before production.
- **Knowledge base** — 8 distilled technique files from Meng To's public skills (video → analysis prompts, interaction-prompt packs, full-page capture, inspiration bundles, the single-file demo contract, 16 3D techniques, 14 SVG illustration styles, ThreeUI components), indexed so the agent consults them instead of improvising.
- **User's asks are law** — explicit requirements are implemented exactly as stated; the skill's own machinery (modes, research, toolkit) is offered, never forced. The agent generates all copy and assets — you supply facts, brand assets and the inspiration pack.
- **Design-tool agnostic** — Figma, Paper, Google Stitch, Google AI Studio, Framer or code-first. You supply the credentials/MCP for your tool of choice.
- **Framework agnostic** — Next.js, React, Vue, Svelte, Astro, plain HTML, WordPress, GoHighLevel — you pick.
- **All animation is delegated** to the [AnimotionJS agentic skill](https://skills.animotion.click/checkout) — this skill never writes animation code itself.
- 25 reference playbooks, 11 department playbooks, a knowledge base (`references/knowledge-base/` — 8 distilled technique files + index), and 10 ready-to-fill templates (builder brief, scaffold HTML, `siteconfig.ts`, outlier anatomy, 3D scene brief, copy, QA report, taste profile, launch brief, template manifest).

## Install

Full guide (per-agent paths, manual install, uninstall): **[docs/INSTALL.md](docs/INSTALL.md)** — worked examples (Modes A, B and E): **[docs/EXAMPLES.md](docs/EXAMPLES.md)**.

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

Other flags: `--license-key=<key>` (save your Pro key during install — see [License & unlocking](#license--unlocking-the-skill)), `--admin-email` / `--admin-secret` (staff), `--force` (overwrite), `--dry-run` (print targets only), `--dir=<path>` (custom destination), `--source=<url|path>` / `--token=<key>` (skill source), `--no-commands` (skip the slash commands).

For **opencode** and **Claude Code**, the installer also writes the **slash commands** globally — `/agentic-web-developer` plus `/agentic-web-developer-<dept>` and the `/awd-<dept>` aliases — to `~/.config/opencode/command/` and `~/.claude/commands/`.

Then **restart your AI agent** so it loads the skill.

> **No local agent? Run it in Google AI Studio.** Paste `references/ai-studio-system-prompt.md` into **System instructions** (a compact, contract-first router — *not* the raw `SKILL.md`, which browsers tend to ignore), enable the **URL Context** tool (the skill fetches its reference files and validates your key from `skills.animotion.click` — no env vars or file attachments needed), add your key to the system instructions, and build in Canvas. Full setup, department mapping and "it builds anyway" troubleshooting: `references/google-ai-studio.md` in the skill.

> **On first run the skill asks for its Pro license key** (or admin credentials) and validates it once per session — or pass it up front with `--license-key=…` and skip the prompt. See [License & unlocking](#license--unlocking-the-skill).

> **Where does the skill come from?** Not from npm — the package ships only the installer, slash commands and docs. The installer fetches the skill from a source you configure (`--source`, `AWD_SOURCE`, or the author's `awd.source` in `package.json`). See [docs/INSTALL.md § Skill source](docs/INSTALL.md#skill-source).

### Supported agents

`opencode` · `claude` · `copilot` · `cursor` · `windsurf` · `codex` · `cline` · `roo` · `cody` · `codium` · `aider` · `continue` · `augment` · `amazonq` · `jetbrains`

The installer writes **each agent's own file format** with the right frontmatter — `SKILL.md` for skill agents, `skill.md` for Windsurf/Codium, `rules/*.mdc` for Cursor, `rules/*.md` for Continue/Augment/Amazon Q, `CONVENTIONS.md` for Aider — and puts the `references/` + `templates/` + `departments/` payload where that agent can read it. Same 15 agents as the AnimotionJS skill.

### Manual install (no CLI)

See **[docs/INSTALL.md](docs/INSTALL.md#manual-install-no-cli)** — per-agent copy instructions for all 15 agents.

## License & unlocking the skill

The skill ships behind the **Animotion Pro plan — $7/month**. One validation per session (cached 7 days) runs before any pipeline work; without it the skill refuses to start. **Mode E (template save/apply) validates with the Template plan — $25/month** — a Pro/Studio key fails that gate by design and gets an upgrade link; Template keys and admin credentials pass everything.

### How to pay for Pro

1. **Click a Get Pro button** (top of this README or above) — opens [`skills.animotion.click/checkout?plan=pro`](https://skills.animotion.click/checkout?plan=pro) with Pro preselected ($7/month). Studio ($15/month) also unlocks this skill *and* the AnimotionJS animation skill you need at the Motion department. **Template ($25/month, [`checkout?plan=template`](https://skills.animotion.click/checkout?plan=template))** unlocks Mode E *and* everything Pro/Studio do — one standalone key, no stacking.
2. **Enter your email** — the license is tied to it.
3. **Continue to Payment** → Stripe's hosted checkout (card).
4. **Confirm** — monthly, cancel anytime.
5. **Copy your key** (`sec_live_…`) from the confirmation page.

### How to give the skill your key (or admin credentials)

Pick one — the gate looks for environment variables first, then the installer's config file, then asks you once:

**1. Install the skill with your key (recommended — one command, everything wired)**

```bash
npx agentic-web-developer install --agent=<your-agent> --license-key=YOUR_KEY

# or install for every detected agent at once:
npx agentic-web-developer install --all --license-key=YOUR_KEY
```

With **admin credentials instead of a license key** (Animotion staff / whitelisted emails only):

```bash
npx agentic-web-developer install --agent=<your-agent> --admin-email=you@example.com --admin-secret=YOUR_ADMIN_SECRET
```

`<your-agent>` is one of the [15 supported agents](#supported-agents) — `opencode`, `claude`, `copilot`, `cursor`, … The installer writes `animotion-config.json` into the installed skill folder with your key (or admin pair), and the gate reads that file automatically — nothing else to configure. The key must be on the **Pro plan** ($7/month) or higher for the pipeline — and on the **Template plan** ($25/month) or admin credentials for Mode E.

**2. Environment variable**

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
export AGENTIC_LICENSE_KEY="sec_live_xxxxxxxx"
```

```powershell
# PowerShell — persistent (open a new terminal afterwards)
setx AGENTIC_LICENSE_KEY "sec_live_xxxxxxxx"
```

`ANIMOTION_LICENSE_KEY` works as an alias — one variable serves this skill and the Animotion installer.

**3. `animotion-config.json` by hand** — same file the installer writes (gate search paths: the skill directory, its parent dir, `~/.animotion-skills/`, or the path in `AGENTIC_LICENSE_CONFIG`):

```json
{
  "tier": "pro",
  "requiredPlan": "pro",
  "authMethod": "license",
  "licenseKey": "sec_live_xxxxxxxx"
}
```

**4. Admin credentials via environment** (Animotion staff / whitelisted emails only) — `AGENTIC_ADMIN_EMAIL` + `AGENTIC_ADMIN_SECRET`. Never commit these; everyone else should use a personal Pro key.

**5. Ask in-session** — with nothing found, the skill asks once (via its question tool); paste the key and it validates immediately.

### What happens at runtime

The skill calls `POST https://skills.animotion.click/api/license/validate` with `{ "skill": "agentic-web-developer", "plan": "pro" }` and your key (or admin pair). On success the verdict is cached at `~/.animotion-skills/cache/agentic-web-developer-verdict.json` for 7 days; offline sessions reuse a fresh cache. Full troubleshooting (invalid key, wrong plan, expired cache, local dev server): **[docs/LICENSING.md](docs/LICENSING.md)**.

### Generation credits — separate from every plan

Your plan covers the **skill**, not the **generation**. Pro, Studio and Template include **zero** asset credits. When you ask the Asset Builder for an image, audio, video or cloud 3D asset, it shows the price first and spends from a prepaid balance you buy separately — **1 credit = $0.05 of Renderful spend**, failed generations refunded automatically. Local headless Blender renders cost **0 credits**.

| Pack | Credits | Price |
|---|---|---|
| Starter | 100 | **$7** |
| Builder | 300 | **$21** |
| Production | 1,000 | **$65** |
| Agency | 3,000 | **$189** |

Buy packs at [`skills.animotion.click/credits`](https://skills.animotion.click/credits) (one-time, no auto-renew, no expiry).

- **Managed credits (default):** when the installer sets `AWD_CREDITS_API_URL`, generation runs through the credits proxy — it holds the Renderful key, prices from the live catalogue, reserves the max, settles at the actual cost and refunds failures. Your license key identifies the account and your balance lives in the proxy ledger (`GET /v1/credits/balance`); checkout is a Stripe link returned by `POST /v1/credits/checkout`.
- **Local / BYO key:** no proxy URL but `RENDERFUL_API_KEY` present — the skill calls Renderful directly and keeps the balance at `~/.agentic-web-developer/credits.json` (CI override: `AWD_CREDIT_BALANCE`).
- Full system, model price tables and the credit-gate rules: `skill/references/asset-credits.md`. Proxy deploy and ops: `server/credits/README.md` and `docs/PRODUCTION.md`.

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

Without it, the skill will still design and build — but it will stop at the Motion department and ask you to install Animotion before any motion work.

## Using the skill

Just talk to your agent:

> "Build me a website that converts for my pool cleaning business"
> "Launch a product website for my new SaaS idea"
> "Build me an immersive 3D website"
> "I have design sketches — turn them into a website"
> "Save this project as a template" / "Build me one from the clinic-landing template"
> "Use the agentic-web-developer skill"

Or jump straight into a department — or any single stage — (opencode + Claude Code, after install):

> `/awd-design` — enter the Design department directly
> `/awd-design 4.3` — jump to a specific stage (Design · Asset production)
> `/awd-list` — print every department and stage; start anywhere, any project, any time
> `/agentic-web-developer-qa` — full-name form of the same command
> `/agentic-web-developer` — router (starts at Strategy unless you name a department)
> `/awd-taste` — train or refine your taste profile (works with or without a project)
> `/awd-assets` — Asset Builder in any mode: audio, video, 3D (credits gate before every batch)
> `/awd-mode-e` — save the open project as a template / list the template library
> `/awd-mode-e-<template-name>` — build a new project from a saved template (Template plan)

The agent classifies the project (Mode A: build-and-sell, Mode B: novel idea, Mode C: advanced 3D/WebGL, Mode D: design-sketch intake, Mode E: template reuse — save/apply templates with an Asset Builder for missing assets), then walks you through every gate — one department at a time, with a progress footer on every response.

## Project layout

```
agentic-web-developer/
├── package.json          # npm manifest (bin: agentic-web-developer, awd.source)
├── bin/install.js        # zero-dependency installer CLI (all 15 agents, per-agent formats, slash commands)
├── commands/             # slash-command files (router + 11 departments + list + taste + assets + mode-e; installer derives /awd-* aliases)
├── skill/                # ← the skill itself (source of truth; never published)
│   ├── SKILL.md          # the router: license gate (incl. Template plan for Mode E), 14 non-negotiables, department map + /awd-list index, modes A–E, footer spec
│   ├── departments/      # 11 department playbooks + INDEX + DEPARTMENT-TEMPLATE
│   ├── references/       # 25 playbooks (incl. mode-e.md, asset-builder.md, asset-credits.md, blender-assets.md, licensing.md, taste-system.md, scroll-craft-integration.md, launch-video.md, saas-animation-craft.md, webgl-interactions.md)
│   ├── assets/           # shipped generator tooling (cineblock_ai_blender_addon.py — the CineBlock AI camera rig for headless Blender)
│   └── templates/        # 10 fill-in templates (incl. 3D scene brief, copy, QA report, taste profile, launch brief, template manifest)
├── docs/                 # ← the only content tracked in Git
│   ├── INSTALL.md        # install guide for all 15 agents
│   ├── EXAMPLES.md       # worked walkthroughs: Mode A, Mode B, Mode E
│   └── LICENSING.md      # Pro plan (+ Template plan for Mode E), payment steps, key/admin credentials
└── README.md             # ← tracked in Git
```

> **Git vs npm vs skill source — nothing public carries your source:**
> - **Git:** only `README.md` and `docs/` are visible (`.gitignore` hides the rest).
> - **npm:** only the installer, slash commands and docs are published (npm tarballs are public forever, so `skill/` and `server/` are excluded) — set `awd.source` in `package.json` before publishing.
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
