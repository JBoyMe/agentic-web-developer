# Visual gates — seeing where the build is and answering at a glance

Agentic Web Developer already stops at a gate after every stage. **Visual gates** are the presentation layer on top of that: the same pipeline, the same one-decision-per-stage rule, but readable at a glance instead of buried in prose.

Two layers, in this order:

| Layer | Always on? | What it is |
|---|---|---|
| **1 · Text** | Yes — every host | Stage rail in the footer, numbered gate cards, `/awd-list` visual map |
| **2 · Rendered** | When the host can show files | `.awd/visual/progress-board.html`, `.awd/visual/gate-card.html`, real screenshots |

Text is the source of truth. The rendered layer is additive — if an artifact and the chat disagree, the chat is right and the artifact is regenerated.

---

## 1 · The stage rail

Every response ends with the footer plus a rail of one glyph per department:

```
📍 Progress — Design · Stage 2/3: Design production (/awd-design)
🧭 Rail — 1✓ 2✓ 3✓ 4⏸ 5○ 6– 7○ 8○ 9○ 10– 11○
⏭️ Next — Design · Stage 3: Asset production (/awd-design)
▶️ Move to the next stage? (yes / stay / jump to <department or stage — full index: /awd-list)
```

| Glyph | Meaning |
|---|---|
| `✓` | Department complete |
| `▸` | Current department, work in progress |
| `⏸` | Current department, gate open — waiting on you |
| `○` | Not started |
| `–` | Skipped / not requested (Backend, Launch, or bypassed) |

The rail is **one glyph per department** — the exact stage is in the Progress and Next lines. Mode E and Mode F print their own rail (`E.1✓ E.2⏸ E.3○ …`, `F.1✓ …`).

## 2 · Gate cards

Each stage ends with one numbered card — what exists, what to look at, and 2–4 options with one recommendation:

```
🚦 GATE — Design · 4.2 Design production
**Produced:** hero + full page design · taste audit 84/100
**Review:** `design/full-page.png` · `design/tokens.json` · http://localhost:3000
**Choose one:**
1. **Approve** — lock the design and move to 4.3 asset production ← recommended
2. **Request changes** — say what to adjust; same direction
3. **Explore another direction** — I'll produce a new 3-up set first
Reply with a number or your own words — this gate stays open until you answer.
```

The card options are the same choices the agent's `question` tool shows — numbering is identical, so either input works. There is never a second question hiding inside an option.

Credit-spending gates add a `Cost:` line with the quoted range and the refund rule before the option that spends.

## 2b · Answering on the board

On the rendered board the options are real buttons, not decoration:

| Do this | Get this |
|---|---|
| Click an option, or press `1`–`4` | It's marked selected and an answer bar appears |
| `Enter`, or the **Copy** button | `4.2 → 1 — Approve` on your clipboard (or selected, if the browser blocks the clipboard) |
| `Esc`, or **Clear** | Selection cleared |
| Reload the page | Selection restored — it's saved in the page's local storage |

Then paste the line in the chat, or just type the number. Here is the limit, stated plainly: **a click cannot reach the agent by itself.** A local HTML page has no channel into your chat, so the board never says "sent", "submitted" or "received" — it captures your choice and hands you the exact reply to paste.

Where the agent has a browser tool and you opened the board as a tab it can read (not just a preview pane), it reads your selection back at the start of its next turn and confirms it in one line — which makes the copy step optional. If it can't read the tab (preview-only pane, closed tab, different port), it asks for the number instead of guessing.

When the agent is showing a `question` tool, that tool is the control — click there. The board is the evidence view.

## 3 · The `/awd-list` visual map

`/awd-list` prints a flow line and a stage-dot matrix before the precise stage table:

```
FLOW (default order only — never enforced)
1 Strategy → 2 Research → 3 Content → 4 Design → 5 Frontend → [6 Backend*]
  → 7 Motion → 8 QA → 9 Deploy → [10 Launch*] → 11 Growth

STAGE MAP   ✓ done · ▸ working · ⏸ gate open · ○ not started · – skipped
 1 Strategy   ✓ ✓ ✓        7 Motion     ○ ○
 2 Research   ✓ ✓          8 QA         ○ ○ ○
 3 Content    ✓ ⏸ ○        9 Deploy     ○ ○
 4 Design     ○ ○ ○       10 Launch     – – –   (on request)
 5 Frontend   ○ ○         11 Growth     ○ ○ ○
 6 Backend    – – –   (on request)
```

With a project open, every dot mirrors `build-state.md` — one dot per stage.

## 4 · The rendered board

When the host can open files, the agent writes two working files into the project:

```
<project>/
└── .awd/
    └── visual/
        ├── progress-board.html   # whole map + current state + open gate + next
        ├── gate-card.html        # the open gate, large (review gates)
        └── shots/
            ├── 4.2-desktop.png
            └── 4.2-mobile.png
```

- **`progress-board.html`** is regenerated at every gate. It shows all 11 department cards with stage bars, the current stage and status pill, the open gate with its numbered options (clickable, with an answer bar), evidence thumbnails, the next step, and Mode E/F lanes when active.
- **`gate-card.html`** is the focused view for review gates (Design, Frontend, QA, Deployment) — same gate, same clickable options, larger.
- Both come from `templates/visual-gates-template.html` — one self-contained file, no network requests, no external fonts. The agent replaces only a marked `CONFIG` object. It is generated from `build-state.md`, never invented.
- Screenshots are captured at **1440×900** and **390×844** and attached to the gate as evidence.

## 5 · Host support

| Host tier | Examples | What you get |
|---|---|---|
| `text` | Google AI Studio, chat-only clients | Rail + gate cards + `/awd-list` map. No file artifacts. |
| `files` | Terminal agents (codex, aider, cline, continue…) | Everything in `text`, plus the files are written and their paths printed — you open them. |
| `render` | opencode (review pane / browser), Claude Code with a viewer, Cursor preview, any agent with a browser tool | Everything in `files`, plus the board opens in the preview and screenshots render inline. |

The agent detects the tier once per session from the tools actually available and records it in `build-state.md` → `## Visual`. It never claims a preview it can't show.

## 6 · Turning it off

Say **"stop with the visuals"** at any time. The agent records `visuals: off` in `## Visual` and stops writing artifacts and screenshot lines for the session. The stage rail stays, because it is part of the progress footer; the gate card falls back to a plain numbered question.

## 7 · Working files, never deliverables

`.awd/` is excluded from the site build: it is added to `.gitignore`, never imported by site code, and stripped by the Deployment department alongside the dev-mode toolkit. QA checks that the production build doesn't contain it.

The method the agent follows lives in the skill at `references/visual-gates.md`; the HTML source at `templates/visual-gates-template.html`.
