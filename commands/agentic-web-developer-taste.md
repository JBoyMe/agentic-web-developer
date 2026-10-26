---
description: Agentic Web Developer — Taste training (teach the agent your taste: dials, POV, idea archive, bans)
---

Run the **agentic-web-developer** skill (read its `SKILL.md` first).

1. **License gate** — run it before any work (at most once per session).
2. **This is the taste trainer, not a department** — it runs inside or outside a project, adds no delivery stage, and never blocks the 11-department flow. Read `references/taste-system.md` and `templates/taste-profile-template.md` before asking anything.
3. **Open the profile** at `~/.agentic-web-developer/taste-profile.md` (browser: the persistent TASTE PROFILE block). Missing → create it from the template. Existing → show a 3-line summary (dials, top bans, last decision-log entry) and offer to refine.
4. **Pick the session** with one gate (options + recommended default):
   - **Quick train** (default, ~5 min): three dials → 3 idea-archive references annotated *what / why it's good / what to steal* → hates list on top of the standing AI-tell bans.
   - **Deep train** (opt-in, offer once after a quick train): 4–6 forced-choice A/B screen pairs, record each winner **in the user's words**, convert the whys into POV lines and bans.
   - **Refine** (anytime the user arrives with changes): apply their words immediately — e.g. "set density to 8", "never use serif for this brand" — then confirm the diff in one line.
5. **One question per response**, options + recommended default (derived from their niche if a project is open), record every answer in the profile and stamp `Last updated`.
6. **Never invent profile entries.** Only the user's words and clearly-labeled defaults. Bans they override get moved to "User-overridden defaults", not deleted.
7. **Training done:** tell them the profile now applies automatically — Strategy shows it at intake, Research gates deviations against it, Design reads it before producing anything (design read → audit → feedback classified back into the profile). If a project is open, append the **progress footer**; if not, close with one line on what was saved.

User arguments: $ARGUMENTS
