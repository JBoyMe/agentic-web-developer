---
description: Agentic Web Developer — Asset Builder: build the site's immersive & interactive assets in-session (image, audio, video, 3D) via managed credits + local Blender, for any mode — then brief Animotion Studio for the controls
---

Run the **agentic-web-developer** skill (read its `SKILL.md` first).

1. **License gate — normal plan check.** Run the standard gate (one verification per session, `plan: "pro"`; a Template key passes too). This command is **not** Mode E: it is available in **every mode (A/B/C/D/E)** and never demands the Template plan on its own.
2. **Pick the transport before anything generates.** If `AWD_CREDITS_API_URL` is set → **managed credits proxy** (send the license key as `x-license-key`; the server holds `RENDERFUL_API_KEY`). Else if `RENDERFUL_API_KEY` is set → **direct Renderful** (local/BYO). Else no cloud generation — Blender / user file / SVG only. Say which one in one line.
3. **Read `references/asset-builder.md` and run stages AB.1 → AB.5** — the whole pipeline:
   - **AB.1 Inventory** — collect what needs building: Mode E template manifest `assets` slots · Mode C scene-brief manifest · the Design asset manifest · or the user's request in `$ARGUMENTS`. Write it to `build-state.md` → `## Assets`.
   - **AB.2 Route** — one route per slot: my file · keep existing · **generate via the credits proxy / Renderful** (credits) · **generate in Blender** (local, 0 credits) · build SVG/procedural · skip. Defaults: image → `flux-dev` 1–2 cr; audio → `speech-2.6-turbo` / `music-2.5` 2–12 cr; video → local Blender render (AI pass 10–20 cr); 3D → local Blender procedural (cloud mesh 8–30 cr); svg → build it.
   - **AB.3 Generate** — *in this session*. Managed: `GET /v1/credits/balance` → `POST /v1/credits/quote` → gate → `POST /v1/credits/generations` (+`Idempotency-Key`) → `GET /v1/credits/generations/{id}` until completed/failed, then download the signed URL immediately. Local: Renderful create → poll → download directly (model allowlist + credit ranges from `references/asset-credits.md` §4). And/or headless Blender per `references/blender-assets.md` (block-animation video, text/image/video → full 3D with materials + animation). **Credit gate before every batch — no exceptions, not even 1 credit.**
   - **AB.4 Ingest & QA** — download to the exact slot path, verify, optimize (WebP / loop check / Draco), update the manifest with reserved/charged credits and the balance after.
   - **AB.5 Control interactions** — write the control-interaction brief (play/pause/scrub, orbit/zoom/reset, mute, scroll-linked rates, keyboard + reduced-motion fallbacks) and hand it to the **AnimotionJS agentic skill (Studio tier)** — never implement controls yourself.
4. **Credits are separate from the license.** Read `references/asset-credits.md`: prepaid packs (100/$7 · 300/$21 · 1,000/$65 · 3,000/$189), 1 credit = $0.05 of Renderful spend. Managed mode: the proxy is the ledger — reserve max, settle at the actual cost, refund failures; buy via `POST /v1/credits/checkout` (fall back to `AWD_CREDITS_CHECKOUT_URL`, then `https://skills.animotion.click/credits`). Local/BYO: balance at `~/.agentic-web-developer/credits.json` (env `AWD_CREDIT_BALANCE` overrides) and you write the refund yourself. Never imply a plan includes credits.
5. **Never block.** No proxy / no key / no Blender / `402` low balance → the fallback ladder in `asset-builder.md`: cheaper model (re-gated) · smaller batch · buy credits · user file · keep existing · SVG · skip.
6. One gate per stage; record routes, reserved/charged credits and balances in `build-state.md`; append the **progress footer** to every response (`Stage AB.n/5`).

User arguments: $ARGUMENTS
