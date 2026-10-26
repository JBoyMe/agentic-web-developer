---
description: Agentic Web Developer — full website system (license-gated; routes into the 11-department flow, starting at Strategy; /awd-list prints every department & stage)
---

Run the **agentic-web-developer** skill (read its `SKILL.md` first).

1. **License gate** — run it before any work (SKILL.md → "License gate"), at most once per session.
2. **Route** — if the user named a department in the arguments (strategy / research / content / design / frontend / backend / motion / qa / deploy / launch / growth), enter that department's file under `departments/` and follow it. A stage ID too (`design 4.3`)? Enter that department **at that stage** (SKILL.md → Routing → Stage-level jump). If they said **list** (or asked what departments/stages exist), run `commands/agentic-web-developer-list.md` instead. If they named **taste** (or asked to train/refine taste), run `commands/agentic-web-developer-taste.md` instead — it is a trainer, not a department. If the arguments start with **assets** (or they ask to generate an image/audio/video/3D asset), run `commands/agentic-web-developer-assets.md` — the Asset Builder works in every mode and is not plan-gated (generation spends separately bought credits). If the arguments start with **mode-e** (e.g. `mode-e` or `mode-e-clinic-landing`), run `commands/agentic-web-developer-mode-e.md` instead — Mode E (template reuse) needs the Template plan ($25/month). Otherwise enter **Strategy** (`departments/strategy.md`) and run its intake — it collects everything later departments need.
3. **Discipline** — self-serve intake from `build-state.md` (ask only what's missing), one gate per stage, record every answer, and append the **progress footer** to every response (SKILL.md → "Progress footer"). Backend and Launch run only if the user asks for them. Jumps are always allowed — any department, any stage, any project, any time.

User arguments: $ARGUMENTS
