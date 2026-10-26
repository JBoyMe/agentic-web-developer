# Examples — the scenarios

The skill runs the same **11-department flow** in every mode (Backend runs only if you ask for it). Every stage ends with a question to you; answers are recorded in `build-state.md`; the agent appends a progress footer to every response. These are complete walkthroughs.

---

## Scenario A — Mode A: build-and-sell a website for a local business

**You say:**

> "Build me a website that converts for my pool cleaning business in Phoenix."

(Or jump straight in: `/awd-strategy`)

**Mode:** A (build-and-sell — the video default). Goal: a site you can sell as a product, plus the outreach system to find buyers.

| Department | What happens | The gate (you answer) |
|---|---|---|
| **1 Strategy** | Agent records: offer ("pool cleaning, weekly plans"), audience (Phoenix homeowners), mode A, no client list yet, $0/mo tool budget. **Taste:** quick 5-min train offered (3 dials, 3 annotated idea-archive refs, hates) → saved to `~/.agentic-web-developer/taste-profile.md`. Runs **M** of M.O.N.E.Y: unsexy niche, 20+ businesses, most sites outdated. Lead pipeline: scrapes 20 Phoenix companies → `leads.csv` | "Confirm the offer/audience — clients yet, or start from zero?" → *"start from zero"* · "Pick the niche: pool cleaning, HVAC, or landscaping?" → *"pool cleaning"* |
| **2 Research** | **Design Blueprint Extractor** on an inspiration site you name (a clean SaaS-style home-services site) → `builderbrief.md`, `scaffold.html`, `tokens.json` + **1–3 proposed deviations** (keep → change → because). **Outlier Research** on 12 pool companies → top 5 / bottom 5 → `outlier-anatomy.md` (winners: price-on-site, booking form, reviews above fold; losers: flash intros, no phone number) | "Approve the inspiration site and the outlier findings?" → *"yes, but keep the blue from the inspiration"* · "Approve the deviations?" → *"take #1, decline #2 and #3"* |
| **3 Content** | Agent drafts every word: H1 options, hero, offer stack, plans, reviews, FAQ, contact — real facts only from you (testimonials, pricing, phone) | "Pick the H1 and confirm the primary CTA" · "Full copy draft — approve or edit?" → *"approve"* |
| **4 Design** | Tool question → *"Stitch"*. Design read declared (style × inspiration + approved deviation · variance/motion/density = 7/5/4 · top bans). Section plan from the anatomy: hero + phone CTA, stat strip, plans grid, how-it-works, reviews, FAQ, quote form. Asset production: hero image, icons, OG image — all generated. Taste audit: **84/100** before the gate | "Which tool — and do you have credentials?" → *"Stitch"* · "Review the design — approve?" → *"approve"* |
| **5 Frontend** | Framework question → *"plain HTML/CSS + a bit of JS"* (cheap hosting). Dev-toolkit offer → *"no"*. Page(s) built 1:1 from the design, content from `siteconfig.ts`, hero iterated until the pool photo leaves room for the headline | "Look at localhost — review?" → *"looks good"* |
| **7 Motion** | You're told **all motion goes to AnimotionJS**: hero reveal, scroll reveals, plan-card hover, counter on the stat strip → motion brief written and handed to the Animotion skill | "Animotion installed? Approve the motion brief?" → *"installed, approved"* |
| **8 Quality Assurance** | Conversion blueprint + UI/UX checklist: H1 "Pool Cleaning That Never Misses a Week" (6 words), AA contrast, form tested, mobile widths; web-quality audit (Lighthouse/CWV/a11y/SEO); `qa-report.md` | "QA passed — approve?" → *"approve"* |
| **9 Deployment** | — | "Deploy where: GitHub→Vercel, GoHighLevel, or WordPress?" → *"GitHub → Vercel"* |
| **10 Growth** | Outreach system: scrapes Phoenix pool companies (Apify, budget-capped), enriches emails, then drafts: *free site as the foot in the door* → hosting retainer ($50–150/mo) → SEO/reviews upsells; Day 1/3/7 follow-ups; analytics wired | "Draft the outreach emails for niche 'pool cleaning'?" → *"send to 20 leads"* |

(Backend never ran — static site, recorded as "not required".)

**Result:** a deployed, converting site + a repeatable client-acquisition loop. The same `siteconfig.ts` makes the next local-business site a clone, not a rebuild.

---

## Scenario B — **Mode B — launch your own product (SaaS)**

**You say:**

> "I have a SaaS idea — FocusFlow, a focus timer with team accountability. I want to launch it."

**Mode:** B (novel idea / product launch — no customer list). Re-scopes Strategy validation, Research outliers, Content/Design/Frontend's conversion goal and surface, and Growth's launch motion.

| Department | What happens | The gate (you answer) |
|---|---|---|
| **1 Strategy** | Records: idea ("FocusFlow — team focus timer"), audience (remote teams / ADHD founders), mode B, **brand assets**: existing teal logo + palette from your deck; **inspiration sites**: linear.app and stripe.com. Validation re-scoped: who has this problem (r/ADHD, remote-work Discords), alternatives (Float, Motion, plain Pomodoro), demand signals (competitor reviews complaining about pricing). No lead scraping | "Confirm the idea/audience — what brand assets exist?" → *"teal logo + palette; new type"* · "Audience: remote teams of 2–10?" → *"yes"* |
| **2 Research** | Extractor runs exactly like Mode A: linear.app as inspiration + **second pass on your brand** (teal palette from the logo/deck) → merged: brand colors win, linear sets the feel. Outliers re-scoped to rival launch pages (Motion, Forest, Pomodoro apps by traffic/reviews) | "Approve the inspiration + extracted brand style?" → *"yes, keep #0D9488 as primary"* |
| **3 Content** | Product copy: demo-led hero, feature benefits, pricing tiers, waitlist CTA — voice gate on brand adjectives | "Pick the H1 and confirm CTA: **Join the waitlist**" · "Copy draft — approve?" → *"approve"* |
| **4 Design** | Tool → *"code-first (Next.js)"* (multi-page app-like site). Product anatomy: demo/video hero, feature grid, integrations logos, pricing tiers, testimonials, FAQ — single CTA | "Approve the design?" → *"approve"* |
| **5 Frontend** | Framework → *"Next.js"* — multi-page scaffold: `/`, `/pricing`, `/docs`. AI-generated abstract hero matched to the teal palette; waitlist form (email only) wired | "Review on localhost?" → *"approve"* |
| **7 Motion** | Motion brief to AnimotionJS: hero mask reveal, feature-card scroll stagger, pricing hover lift, waitlist-button magnetic hover | "Animotion installed? Approve brief?" → *"approved"* |
| **8 Quality Assurance** | Same checklists, goal adjusted: H1 "Focus Together, Finish Faster" (5 words), one CTA everywhere, form → provider tested, responsive pass | "QA passed?" → *"approve"* |
| **9 Deployment** | — | "Deploy where?" → *"GitHub → Vercel + custom domain"* |
| **10 Growth** | Re-scoped from cold outreach: waitlist/launch email sequence, founder outreach (remote-work communities, r/SaaS), Product Hunt draft — same email rules (human subject, no hard ask, proof + link); monetization = trial/paid tiers; analytics events on the waitlist | "Draft the launch emails and PH post?" → *"yes"* |

**Result:** a live multi-page product site with your brand DNA extracted alongside the inspiration, waitlist converting, and a launch sequence ready to send.

---

## Scenario E — **Mode E — save a project as a template, then build from it**

**You say (on the finished pool-cleaning project):**

> "Save this project as a template." — or `/awd-mode-e`

**Mode:** E (template reuse — Template plan, $25/month). Not a department: two flows with their own stages.

| Stage | What happens | The gate (you answer) |
|---|---|---|
| **E.S1 Source scan** | Inventories the project: framework, pages, mode, `brand.md`, assets, copy, SEO, deploy target | "Found [11 pages, HTML/CSS, 24 assets, mode A] — save this as a template?" → *"yes"* |
| **E.S2 Placeholder extraction** | Marks swap points as namespaced tokens `{{AWD:…}}` — logo, business name, phone, H1s, testimonials, pricing, colors/type, links | "Swap slots found: 27 (12 copy, 6 assets, 5 brand, 4 links). Extract all?" → *"yes"* |
| **E.S3 Sanitization** | Strips `build-state.md`, credentials, personal data, one-off client facts; demo assets marked `keep-demo` | "Sanitize clean — nothing client-specific left?" → *"approve"* |
| **E.S4 Manifest + save** | Writes `template-manifest.json` (slot contract) + `template.md` card into `~/.agentic-web-developer/templates/<slug>/` | "Name the template: `pool-cleaning-landing`?" → *"pool-cleaning-landing"* |

**Later — you say:**

> "Build me one from the pool-cleaning template for a Phoenix HVAC company." — or `/awd-mode-e-pool-cleaning-landing`

**E.1 → E.6 (apply):** instantiate the template into a new folder (`build-state.md`, `mode: E`) → **swap interview** (one gate per slot group: brand, copy, contact, links) → **Asset Builder** per missing asset (user file · keep demo · generate via the managed credits proxy or Renderful with a credit gate · local Blender · skip) → content/SEO swap → **light pipeline** (Motion brief → QA full pass → Deploy; Research/Design/Frontend skipped — the template already carries them) → sign-off sweep: every `{{AWD:` token gone, zero leftovers.

**Result:** a new client site in a fraction of a full build, from a sanitized contract — the same move that turns your first sale into a product line.

---

## Asset Builder — any mode, any time

**You say (mid-build, any project):**

> "/awd-assets hero loop" — or "generate a voiceover for the demo", "make me a 3D coffee cup for this hero"

**Mode:** the project's own mode (A–E). The Asset Builder is not a mode: it is the single asset pipeline every mode calls. Credits are **separate from the license plan** — say so the first time it comes up.

| Stage | What happens | The gate (you answer) |
|---|---|---|
| **AB.1 Inventory** | Scans the project for missing/weak media and writes one row per slot into `## Assets`: slot, kind, brief, route, model/engine, credits reserved/charged, status | "Found 4 asset slots (hero video, voiceover, 3 product stills, 6 3D props). Build all?" → *"the video + voiceover"* |
| **AB.2 Route** | Picks the engine per slot: **my file** · **keep existing** · **managed credits / Renderful** (image/audio/video/3D mesh) · **local Blender** (0 credits: block-animation video, full 3D with materials + animation) · **SVG** · **skip** — checks `AWD_CREDITS_API_URL` (or `RENDERFUL_API_KEY`), Blender, balance | "Hero loop: block it in Blender (0 cr) then one Wan 2.6 AI pass (10–20 cr), or straight text→video (10–20 cr)?" → *"block then pass"* |
| **AB.3 Generate** | Runs the credit gate, then generates in-session: managed proxy quote → create → poll → download signed URL (or direct Renderful create → poll → download); or headless `blender --background --python` (blockout → playblast → AI pass; or mesh → UV → PBR → lights → keyframes → Draco `.glb`) | "Generate **2 assets**? hero-loop · wan-2.6 · **10–20 cr** · voiceover · speech-2.6-turbo · **2–5 cr** — balance 40, reserve 25 → 15" → *"generate"* |
| **AB.4 Ingest & QA** | Files assets into the project, records dimensions/duration/codec, runs the playback contract (muted/loop/poster/reduced-motion), checks budgets; **records reserved vs settled credits** (managed: the proxy already reconciled; local: deduct after a successful download, refund failures) | "Both ingested and playing. Poster + reduced-motion fallbacks set." → *"approve"* |
| **AB.5 Control interactions** | Writes a row-per-asset brief (play/pause, scrub, orbit/zoom/reset, mute, scroll-driven playback) and hands it to **Animotion Studio** (the AnimotionJS agentic skill, Studio tier) | "Controls for hero loop + 3D cup are briefed for Animotion — build them now?" → *"yes"* |

**Never blocks:** no key / no Blender / empty balance → cheaper model (re-gated) · buy credits · user file · keep existing · SVG · skip.

---

## What's identical in every mode

- Inspiration-site **design DNA extraction** and **brand-style extraction** (Research) — always followed by **1–3 gated in-style deviations**, so the result evolves the inspiration instead of copying it
- The **taste profile** (read before design, audit before approval, lasting feedback filed back) — train or refine it any time with `/awd-taste`
- The conversion blueprint and QA checklists (Content + Quality Assurance)
- Deployment (Deployment — the user always picks the target)
- **The animation rule:** no motion code is ever written by this skill — Motion hands a motion brief to the **AnimotionJS agentic skill** for all 15 supported agents; **control interactions** for audio/video/3D assets are briefed at AB.5 and built by Animotion **Studio**
- **The Asset Builder** (`/awd-assets`) — every mode can inventory, route, generate (managed credits, direct Renderful, or local headless Blender), ingest/QA and brief controls for audio, video and 3D; credits are a separate prepaid purchase and every batch passes a credit gate
- A question gate at the end of every stage, a progress footer on every response, and `/awd-<dept>` commands to jump into any department

**Mode E difference:** the apply flow runs the **light pipeline** only (Motion → QA → Deploy) — Research/Design/Frontend work is already baked into the template. Gates, footer, taste and the animation rule stay identical.

Install for your agent: [INSTALL.md](./INSTALL.md).
