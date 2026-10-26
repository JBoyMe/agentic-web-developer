---
description: Agentic Web Developer — Mode E (template reuse): save the open project as a template, list the template library, or build a new project from a template (Asset Builder for missing assets)
---

Run the **agentic-web-developer** skill (read its `SKILL.md` first).

0. **Command-name fallback:** `/awd-mode-e-<template-name>` and `/agentic-web-developer-mode-e-<template-name>` have no per-template command files — when the user's message starts with either base command followed by a hyphenated template name (even if your host didn't match a command), treat this file as the matched command with `$ARGUMENTS` = that template name. Never reply "unknown command".

1. **License gate — Template plan:** run the gate before any work, but validate with `"plan": "template"` (not `"pro"`). A Pro/Studio key fails by design — report `reason` + the Template ($25/month) unlock at https://skills.animotion.click/checkout?plan=template (or admin credentials); never tell them to get Pro/Studio. A Template key or admin pair passes for the whole session — the standing department gate counts as satisfied. At most one verification per session.
2. Read `references/mode-e.md` and follow it exactly — it owns both flows:
   - **`$ARGUMENTS` names a template** (`/awd-mode-e-clinic-landing`) → **E-Apply**: instantiate `~/.agentic-web-developer/templates/<name>/project/` into the target directory (ask only if ambiguous), create `build-state.md` (`mode: E`), then run stages **E.1 → E.6** (swap interview → Asset Builder per `references/asset-builder.md` → content/SEO swap → light pipeline Motion/QA/Deploy → zero-token sign-off). Unknown name → list the library and offer to start.
   - **No arguments + a project with site code is open** → **E-Save**: run stages **E.S1 → E.S4** (scan → placeholder extraction → sanitization → manifest + save to the library). Ask first if the intent is ambiguous (save vs build).
   - **No arguments + no project** → list `~/.agentic-web-developer/templates/` (each `template.md` card) and ask: pick a template to build from, or save a project as one.
3. One gate per stage; record everything under `## Mode E` in `build-state.md`; append the **progress footer** to every response (Mode E stages print as `Stage E.n/6`, save flow `E.Sn/4`).
4. Asset generation never blocks: no proxy / no `RENDERFUL_API_KEY` / no Blender / empty balance → offer user file / keep demo / SVG / skip; **always credit-gate before generating** — credits are a separate purchase from the $25 plan (`references/asset-credits.md`), local Blender routes cost 0 credits, and every controllable asset gets its AB.5 control-interaction brief for Animotion Studio.

User arguments: $ARGUMENTS
