# agentic-web-developer

An **agentic skill** that turns an AI coding agent into a complete web-development and website-selling system — organized as **11 departments** (Strategy → Research → Content → Design → Frontend → Backend → Motion → QA → Deploy → Launch → Growth), each with its own slash command (`/agentic-web-developer-<dept>`, short alias `/awd-<dept>`).

Plus a **novel-idea / product-launch mode** for websites not covered by the videos (SaaS, products, marketplaces).

And a **Mode C** for advanced 3D / WebGL sites — cinematic Three.js builds in the style of Kage and Towers.

Plus a **Mode D** for design-sketch intake — hand over your sketches/wireframes and the skill reads the pages and layouts off them, confirms an inventory, and runs only the departments needed.

And a **Mode E** for template reuse — save any finished project as a reusable template (`/awd-mode-e`), then build new projects from it (`/awd-mode-e-<template-name>`): swap interview, Asset Builder for missing assets, light pipeline (Template plan, $25/month).

Every mode also ships the **Asset Builder** (`/awd-assets`) — every image, video, audio clip and 3D asset generated **inside your session** by **Renderful through managed credits**, paid **only with non-expiring prepaid top-up packs** (there are no monthly plan credits), and it is the **only** way to add assets to a project. Client brand files (logo, brand photography, product shots) are the one exception: they enter as **inputs**, never generated. When the balance is short the Asset Builder prints an explicit top-up gate and stops the asset stage — there is no keep-demo, skip, SVG or local-renderer fallback.

> **The skill is free.** No license key, no subscription, no entry gate — install it and run every department, modes A–D included. Two paid gates remain, each charged only when used: **[Get Template — $25/mo](https://skills.animotion.click/checkout?plan=template)** (templates: Mode E and Mode F), and prepaid **[asset-credit top-ups](#generation-credits--top-ups-only)** for Renderful generation. Motion needs no gate — the agent builds it and it costs nothing. [![Get Template — $25/mo](https://img.shields.io/badge/Get_Template-%2425%2Fmonth-6C2BD9)](https://skills.animotion.click/checkout?plan=template) — payment steps and credential setup: **[License & paid gates](#license--paid-gates)** · full guide **[docs/LICENSING.md](docs/LICENSING.md)**.

## What you get

- **11-department system** — Strategy (intake, mode, validation) · Research (design DNA + competitor intelligence) · Content (all the copy, agent-written) · Design (UI/UX + generated assets) · Frontend (framework, scaffold, build) · Backend (server-side, *only on request*) · Motion (motion brief + agent-built motion) · Quality Assurance (conversion, a11y, perf, SEO) · Deployment (ship + verify) · Launch (product launch films & logo animations as MP4 via HyperFrames, *on request*) · Growth (launch, outreach, monetization) — **one gate per stage, progress footer + stage rail on every response**, the agent **never runs ahead on assumptions**.
- **Slash commands + free navigation** — `/awd-strategy`, `/awd-research`, `/awd-content`, `/awd-design`, `/awd-frontend`, `/awd-backend`, `/awd-motion`, `/awd-qa`, `/awd-deploy`, `/awd-launch`, `/awd-growth`, plus **`/awd-list`** (prints every department **and every stage** — start at any department or stage of any project at any time, e.g. `/awd-design 4.3`) and **`/awd-taste`** (taste training — not a department), **`/awd-assets`** (Asset Builder — audio, video, 3D in any mode) and **`/awd-mode-e`** (template save/list; `/awd-mode-e-<template>` to build from a template — Template plan) (full `/agentic-web-developer-*` names and the `/agentic-web-developer` router). Installed globally for **opencode** and **Claude Code**; `--no-commands` to skip.
- **Asset Builder in every mode** — `/awd-assets` (also Design **4.3** and Mode E **E.3**): inventory → route → generate → ingest & QA → control-interaction brief. Exactly **two sources**: client **brand files** as inputs (`brand-input`, never generated) and **Renderful generation** through the managed credits proxy (no user keys) for image, audio (text → voice/music/SFX, sound-in → transformed audio), video (text/image → video) and 3D meshes. **The only way to add assets to a project** — never another generator, API, MCP tool, hand-drawn SVG or local renderer. Credits: **1 credit = $0.05 of Renderful spend**, bought as prepaid top-ups only (**100/$7**, **300/$21**, **1,000/$65**, **3,000/$189** — never expire; there are **no monthly plan credits**). A short balance prints an explicit top-up gate and **stops the asset stage**; it never falls back. Every control interaction is built by the agent with the modern web-animation stack. `references/asset-builder.md`, `references/asset-credits.md`.
- **Launch department (on request)** — 15–30s product launch film + 5–8s logo sting rendered to MP4 with HyperFrames — agent-exclusive in the launch-video format (live-site capture + agent screen recordings + the project's development assets — never screenshots alone; brand-led scenes, cinematic camera shots, animated text, transitions, music/SFX timed to on-screen action, editable by chat, per-channel cut variants): brief → capture & look system → storyboard & build → senior-designer critique loop & render. After Effects-quality motion via the AE → HyperFrames motion dictionary, the agency-grade SaaS motion canon (asymmetric ease families, overlapping keyframes, 16-shot library, six brand style packs — Apple/Google/AI/workspace/viral-reel/explainer — distilled from a 164-video SaaS animation playlist), **and the Claude Video 2.0 studio system** (21-look gallery + `STYLE.md` law, 5 hacks, 3-still approval gate, one-clock loop craft, media mode — agent-exclusive material (development assets, live-site capture, agent screen recordings) with optional AI shots behind a credit-cost gate — from JBoyMe/claude-video-2); runs in a local agent (needs a shell). `departments/launch.md`, `references/launch-video.md`, `references/saas-animation-craft.md`, `references/motion-studio-system.md`.
- **Taste training** — users *train* the agent's taste into a global profile (`~/.agentic-web-developer/taste-profile.md`: three dials, point of view, annotated idea archive, ban list). The agent reads it before designing, declares a one-line design read, **always proposes 1–3 gated in-style deviations** over the inspiration (declining = faithful recreation), audits the result 0–100 before approval, and files lasting feedback back into the profile — taste compounds across projects, never assumed.
- **Immersive scroll design (method — the agent owns the motion)** — an optional scroll-appetite gate at Strategy feeds a full design pass in Design: pick **one of 8 page grammars** (filmic, chaptered, live surface, continuous world, typographic poster, gallery, split stage, cutlist), write a **feeling curve with exactly one engineered peak**, invent a **signature move**, clear a **fingerprint gate** (≥4/6 dimensions differ from your prior builds), and pass taste-floor additions + a layered-hero spec — then Motion turns it into a beat-by-beat **device score table mapped to the motion toolkit**, and QA runs a **scroll craft checklist** (contact sheet, dead scroll, cue opacity, frozen media, cold feel check). Scroll-craft's *design method* only; its runtime engine is never shipped. `references/scroll-craft-integration.md`.
- **Project taste file (`brand.md`)** — drop a `brand.md` in the project root and every department reads it before design, copy or asset work: its hard rules (palette, fonts, voice, don'ts) override skill defaults and the taste profile the way a client brand book would. The agent offers to create one at Strategy intake.
- **Intakes explain themselves** — every intake question ships with a *Why* (why it's asked) and an *Example* (a good answer), so you always know what to say next.
- **Gates you can see** — every gate is a numbered card (what was produced · real review artifacts · 2–4 options · one recommended) and every response ends with an 11-department **stage rail** (`1✓ 2✓ 3▸ 4○ …`), so progress reads at a glance instead of in prose. When the host can open files, the agent also writes `.awd/visual/progress-board.html` + `gate-card.html` from `build-state.md` — a live map of all departments, the open gate and its evidence, regenerated at every gate — and attaches real desktop + mobile screenshots at review gates. **The board is answerable:** options are clickable (keys `1`–`4`, `Enter` copies, `Esc` clears), the pick survives a reload, and the agent reads it back where it can — but a click is never claimed as "sent", because a local page has no channel into the chat. Text always works alone (terminal agents, AI Studio, chat-only clients); the artifacts are working files that never ship. `references/visual-gates.md` · [docs/VISUAL-GATES.md](docs/VISUAL-GATES.md).
- **Five modes** — Mode A build-and-sell, Mode B novel idea / product launch, Mode C advanced 3D / WebGL experience, Mode D design-sketch intake, Mode E template reuse (save a project as a template / build from one, with an Asset Builder for missing assets).
- **Realistic Three.js / WebGL craft (static scenes)** — PBR realism dials, fragment shader programs (palettes, noise/fbm, SDFs, dissolve/glitch passes with their time uniforms exposed), particle-system design (forces, curl-noise flow fields, GPU `Points`), product viewers/configurators, 3D data viz, React Three Fiber patterns, and a static-scene screenshot verify loop. You build the world; every clock, simulation step and transition is built by the Motion department with the modern web-animation stack — no `u_time` drift or render-loop animation is ever authored here. Distills the `3d-visualizer` skill (via explainx.ai) and `webgl-animation-skills`. `references/webgl-interactions.md`.
- **Dev-mode toolkit (opt-in, removable)** — a live CSS styling toolbar plus a prototyping toolbar (hotspots, viewport switcher, grid/measure, states, annotations), gated behind an ask-first question and wrapped in one flag / one marked block so it's fully stripped before production.
- **Knowledge base** — 8 distilled technique files from Meng To's public skills (video → analysis prompts, interaction-prompt packs, full-page capture, inspiration bundles, the single-file demo contract, 16 3D techniques, illustration style vocabulary for generation prompts, ThreeUI components), indexed so the agent consults them instead of improvising.
- **User's asks are law** — explicit requirements are implemented exactly as stated; the skill's own machinery (modes, research, toolkit) is offered, never forced. The agent generates all copy and assets — you supply facts, brand assets and the inspiration pack.
- **Design-tool agnostic** — Figma, Paper, Google Stitch, Google AI Studio, Framer or code-first. You supply the credentials/MCP for your tool of choice.
- **Framework agnostic** — Next.js, React, Vue, Svelte, Astro, plain HTML, WordPress, GoHighLevel — you pick.
- **All motion is built by the agent** with the modern web-animation stack — **GSAP (+ScrollTrigger), Motion (motion.dev / Framer Motion), Lenis, Lottie, Rive, Theatre.js, CSS scroll-driven animations + View Transitions, spring physics / WAAPI, three.js + React Three Fiber (+drei, postprocessing), matter.js, unicorn-studio** — for site motion **and** 3D animation (camera paths, shader clocks, particles, ambient weather). No separate install, no license and no purchase: motion needs none, and the agent always respects `prefers-reduced-motion` and the project's conversion goals. `references/motion-toolkit.md`.
- 27 reference playbooks, 11 department playbooks, a knowledge base (`references/knowledge-base/` — 8 distilled technique files + index), and 11 ready-to-fill templates (builder brief, scaffold HTML, `siteconfig.ts`, outlier anatomy, 3D scene brief, copy, QA report, taste profile, launch brief, template manifest, visual board).

## Install

**The skill is 100% free.** No license key, no trial, no account, no signup, no credit card: `npx` pulls the installer, the installer fetches the skill, and every department plus Modes A–D work immediately. The only things that ever ask for a key are the two optional paid gates — templates and generated assets — and only at their own moment. See [License & paid gates](#license--paid-gates).

**Requires:** Node.js 18+ and one of the [15 supported agents](#supported-agents) — or a browser, through Google AI Studio.

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

Then **restart your AI agent** so it loads the skill. Type `/agentic-web-developer` (or `/awd-strategy`) — or just describe the site you want to build — and it starts at Strategy · Stage 1 with **no key prompt**.

Other flags: `--license-key=<key>` (save a key for the paid gates — Template plan, credit auth — **never needed to unlock the skill**), `--admin-email` / `--admin-secret` (staff), `--force` (overwrite or update), `--dry-run` (print targets only), `--dir=<path>` (custom destination), `--source=<url|path>` / `--token=<key>` (skill source), `--no-commands` (skip the slash commands).

For **opencode** and **Claude Code**, the installer also writes the **slash commands** globally — `/agentic-web-developer` plus `/agentic-web-developer-<dept>` and the `/awd-<dept>` aliases — to `~/.config/opencode/command/` and `~/.claude/commands/`.

### Free vs. paid at a glance

| What you use | Cost |
| --- | --- |
| Install, all 11 departments (Strategy → Growth), every stage | **Free** |
| Modes A (build & sell), B (product launch), C (3D/WebGL), D (design sketches) | **Free** |
| 27 reference playbooks, 11 blank project templates, visual gates, dev-mode toolkit | **Free** |
| Client brand files used as asset inputs | **Free** |
| Mode E/F — save a template / build from one / maintain a site | Template plan, $25/month |
| Renderful generation — image / video / audio / 3D | Prepaid top-up credits |

### Check the install

```bash
npx agentic-web-developer detect      # every detected agent + install path
```

Inside your agent, `/awd-list` prints the 11-department stage index and `/awd-assets` opens the Asset Builder — if both respond, the skill tree, all references and the 31 slash commands are in place. Update anytime with `npx agentic-web-developer install --agent=<agent> --force`. Per-agent paths, manual copy install and uninstall: **[docs/INSTALL.md](docs/INSTALL.md)**. Worked examples (Modes A, B and E): **[docs/EXAMPLES.md](docs/EXAMPLES.md)**.

> **No local agent? Run it in Google AI Studio.** Paste `references/ai-studio-system-prompt.md` into **System instructions** (a compact, contract-first router — *not* the raw `SKILL.md`, which browsers tend to ignore), enable the **URL Context** tool (the skill fetches its reference files from `skills.animotion.click` — no env vars or file attachments needed), and build in Canvas. No key is needed to start; add one only if you plan to use Mode E/F or generated assets. **AI Studio reads the deployed skills payload, not npm** — a new release only reaches it after the payload is deployed to `skills.animotion.click` and you re-paste the router. Asset generation there still needs the credits proxy and a license key; a browser cannot hold `RENDERFUL_API_KEY` and there is no local or zero-credit lane — if the key or balance is missing, the asset stage prints the top-up gate and stops. Full setup, update check, department mapping and "it builds anyway" troubleshooting: `references/google-ai-studio.md` in the skill.

> **Upgrading from a licensed build?** The skill used to ask for a key before anything ran. It no longer does — reinstall with `npx agentic-web-developer install --agent=<agent> --force` and it starts at Strategy · Stage 1 without a prompt. Any key you saved still works, for the paid gates only.

> **Where does the skill come from?** Not from npm — the package ships only the installer, slash commands and docs. The installer fetches the skill from a source you configure (`--source`, `AWD_SOURCE`, or the author's `awd.source` in `package.json`). See [docs/INSTALL.md § Skill source](docs/INSTALL.md#skill-source).

### Supported agents

`opencode` · `claude` · `copilot` · `cursor` · `windsurf` · `codex` · `cline` · `roo` · `cody` · `codium` · `aider` · `continue` · `augment` · `amazonq` · `jetbrains`

The installer writes **each agent's own file format** with the right frontmatter — `SKILL.md` for skill agents, `skill.md` for Windsurf/Codium, `rules/*.mdc` for Cursor, `rules/*.md` for Continue/Augment/Amazon Q, `CONVENTIONS.md` for Aider — and puts the `references/` + `templates/` + `departments/` payload where that agent can read it.

### Manual install (no CLI)

See **[docs/INSTALL.md](docs/INSTALL.md#manual-install-no-cli)** — per-agent copy instructions for all 15 agents.

## License & paid gates

**The skill is free** — no Pro plan, no entry validation, no key needed for any department or mode A–D. Exactly two things are paid:

| What | Price | Checked when |
|---|---|---|
| The skill | **Free** | Never |
| **Template plan** (Mode E templates, Mode F maintenance) | **$25/month** | Before `/awd-mode-e*` / `/awd-mode-f*` work |
| **Asset-credit top-ups** (generation) | packs from **$7** | Before every Asset Builder generation |

### How to pay for the Template plan (templates)

[Get Template — $25/month](https://skills.animotion.click/checkout?plan=template) — required to save a project as a template, build from a template (`/awd-mode-e*`), or maintain an AWD-built site (`/awd-mode-f*`). Non-Template keys fail that gate by design; Template keys and admin credentials pass. The departments themselves stay free — never stack plans. Got a Template key? Install with it below: [How to give the skill your key](#how-to-give-the-skill-your-key-or-admin-credentials).

### How to give the skill your key (or admin credentials)

Pick one — the paid gates look for environment variables first, then the installer's config file, then asks you once:

**1. Install the skill with your key (recommended — one command, everything wired)**

```bash
npx agentic-web-developer install --agent=<your-agent> --license-key=YOUR_KEY \
  --credits-url=https://skills.animotion.click

# or install for every detected agent at once:
npx agentic-web-developer install --all --license-key=YOUR_KEY \
  --credits-url=https://skills.animotion.click
```

`--credits-url` wires the **managed credit packs** (prepaid top-ups — the only credits there are) into
`~/.agentic-web-developer/config.json`; without it there is no generation at all — the Asset Builder prints the credential/top-up gate and stops the asset stage (no local renderer, no user-file fallback, no SVG).
Packs and prices: [Generation credits](#generation-credits--top-ups-only).

**With your Template plan key (Mode E templates · Mode F maintenance)**

Bought the **Template plan** ([Get Template — $25/month](https://skills.animotion.click/checkout?plan=template))? Install the same way — pass your **Template key** as `--license-key`:

```bash
# Template key — unlocks Mode E (save a template / build from one) and Mode F (site maintenance):
npx agentic-web-developer install --agent=<your-agent> --license-key=YOUR_TEMPLATE_KEY \
  --credits-url=https://skills.animotion.click

# or install for every detected agent at once:
npx agentic-web-developer install --all --license-key=YOUR_TEMPLATE_KEY \
  --credits-url=https://skills.animotion.click
```

The installer saves the key into `animotion-config.json` like any other key. The Mode E/F gate validates it server-side with `plan: "template"` — **Template keys and admin credentials pass; other plans fail that gate by design** ([LICENSING.md](docs/LICENSING.md)). One Template key covers everything Mode E/F need **and** serves credit auth — nothing else to buy or wire: save a template with `/awd-mode-e`, build from one with `/awd-mode-e-<template-name>`, maintain an AWD-built site with `/awd-mode-f*`. The skill itself and Modes A–D stay free either way.

With **admin credentials instead of a license key** (staff / whitelisted emails only):

```bash
npx agentic-web-developer install --agent=<your-agent> --admin-email=you@example.com --admin-secret=YOUR_ADMIN_SECRET
```

`<your-agent>` is one of the [15 supported agents](#supported-agents) — `opencode`, `claude`, `copilot`, `cursor`, … The installer writes `animotion-config.json` into the installed skill folder with your key (or admin pair), and the gates read that file automatically — nothing else to configure. Use a **Template plan** ($25/month) or admin credentials for Mode E/F; any valid key serves credit auth.

**2. Environment variable**

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
export AGENTIC_LICENSE_KEY="sec_live_xxxxxxxx"
```

```powershell
# PowerShell — persistent (open a new terminal afterwards)
setx AGENTIC_LICENSE_KEY "sec_live_xxxxxxxx"
```

`ANIMOTION_LICENSE_KEY` works as an alias — one variable serves this skill and the credits proxy.

**3. `animotion-config.json` by hand** — same file the installer writes (gate search paths: the skill directory, its parent dir, `~/.animotion-skills/`, or the path in `AGENTIC_LICENSE_CONFIG`):

```json
{
  "tier": "template",
  "requiredPlan": "template",
  "authMethod": "license",
  "licenseKey": "sec_live_xxxxxxxx"
}
```

**4. Admin credentials via environment** (staff / whitelisted emails only) — `AGENTIC_ADMIN_EMAIL` + `AGENTIC_ADMIN_SECRET`. Never commit these.

**5. Ask in-session** — with nothing found, a gate asks once (via its question tool); paste the key and it validates immediately.

### What happens at runtime

- **Departments: nothing** — there is no entry gate.
- **Mode E/F:** the gate calls `POST https://skills.animotion.click/api/license/validate` with `{ "skill": "agentic-web-developer", "plan": "template" }` and your key (or admin pair). On success the verdict is cached at `~/.animotion-skills/cache/agentic-web-developer-verdict.json` for 7 days; offline sessions reuse a fresh cache.
- **Motion:** nothing to check — motion is built by the agent and needs no key or purchase.
- **Credits:** generation authenticates with the same key against the credits proxy; top-ups only.

Full troubleshooting (invalid key, wrong plan, expired cache, local dev server): **[docs/LICENSING.md](docs/LICENSING.md)**.

### Generation credits — top-ups only

Generation credits are **separate from every plan** — and there are none bundled anyway: **there are no monthly plan credits.** Plans grant no starter allowance — generation is paid **only** with one-time top-up packs that **never expire**:

| What | Credits | Price |
|---|---|---|
| Starter | 100 | **$7** |
| Builder | 300 | **$21** |
| Production | 1,000 | **$65** |
| Agency | 3,000 | **$189** |

**1 credit = $0.05 of Renderful spend.** The Asset Builder quotes a min-max range before generating, settles at the actual cost Renderful returns, and refunds failures automatically. Top-ups are one-time purchases (no auto-renew). Buy them from the Asset Builder with your key — it calls `POST /v1/credits/checkout` and shows the Stripe link (static fallback: https://skills.animotion.click/credits). **A short balance blocks the asset stage:** the Asset Builder prints an explicit top-up gate (pack table + checkout) and waits. It never falls back to a demo asset, a skipped slot, a hand-drawn SVG, another generator or a local renderer; the rest of the build may continue.

- **Managed credits — the only mode:** when the installer sets `AWD_CREDITS_API_URL`, generation runs through the credits proxy — it holds the Renderful key, prices from the live catalogue, reserves the max, settles at the actual cost and refunds failures. Your license key identifies the account and your balance lives in the proxy ledger (`GET /v1/credits/balance` → `balance`, `GET /v1/credits/history`). There is no direct/BYO key mode and no local balance file.
- **Brand files are inputs, not generations:** a client logo, brand photography or product shot is copied into its slot and marked `brand-input`. Everything else is generated.
- Full system, model price tables and the credit-gate rules: the skill's `references/asset-credits.md`. Proxy deploy and ops: `docs/PRODUCTION.md`.

You can also download the skill files directly — copy-paste commands in [docs/LICENSING.md § Install the skill files](docs/LICENSING.md#install-the-skill-files-no-key-needed).

## Motion (built by the agent — no separate skill, no license)

Every website built with this skill gets **all of its motion built by the agent** — hero reveals, scroll effects, hover states, counters, parallax, text FX, **and 3D animation** (camera paths, orbits, shader clocks, particles, ambient weather) — with the modern web-animation stack: **GSAP (+ScrollTrigger), Motion (motion.dev / Framer Motion), Lenis, Lottie, Rive, Theatre.js, CSS scroll-driven animations + View Transitions, spring physics / WAAPI, three.js + React Three Fiber (+drei, postprocessing), matter.js, unicorn-studio**. There is **no separate install, no license and no purchase** — motion needs none, and no motion setup is ever mandated: the Motion department writes the motion brief and implements it directly in the project's own codebase.

- The agent always respects **`prefers-reduced-motion`** and the project's **conversion goals** — motion serves the sell, never the other way round.
- Full toolkit and technique reference: `skill/references/motion-toolkit.md`.

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
│   ├── SKILL.md          # the router: paid gates (free skill; Template plan for Mode E/F, top-up credits for generation), 15 non-negotiables, department map + /awd-list index, modes A–F, footer spec
│   ├── departments/      # 11 department playbooks + INDEX + DEPARTMENT-TEMPLATE
│   ├── references/       # 27 playbooks (incl. mode-e.md, mode-f.md, visual-gates.md, asset-builder.md, asset-credits.md, motion-toolkit.md, licensing.md, taste-system.md, scroll-craft-integration.md, launch-video.md, saas-animation-craft.md, motion-studio-system.md, webgl-interactions.md)
│   └── templates/        # 11 fill-in templates (incl. 3D scene brief, copy, QA report, taste profile, launch brief, template manifest, visual board)
├── docs/                 # ← the only content tracked in Git
│   ├── INSTALL.md        # install guide for all 15 agents
│   ├── EXAMPLES.md       # worked walkthroughs: Mode A, Mode B, Mode E
│   └── LICENSING.md      # free skill + two paid gates (Template plan, credit top-ups), payment steps, key/admin credentials
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
