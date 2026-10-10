# Examples — the two scenarios

The skill runs the same 11-stage gated pipeline in both modes. Every stage ends with a question to you; answers are recorded in `build-state.md`. These are two complete walkthroughs.

---

## Scenario A — Mode A: build-and-sell a website for a local business

**You say:**

> "Build me a website that converts for my pool cleaning business in Phoenix."

**Mode:** A (build-and-sell — the video default). Goal: a site you can sell as a product, plus the outreach system to find buyers.

| Stage | What happens | The gate (you answer) |
|---|---|---|
| 0 — Intake | Agent records: offer ("pool cleaning, weekly plans"), audience (Phoenix homeowners), mode A, no client list yet, $0/mo tool budget | "Confirm the offer and audience — and do you have any clients/leads yet, or start from zero?" → *"start from zero"* |
| 1 — Money framework | Runs **M** of M.O.N.E.Y: validates "pool cleaning in Phoenix" — unsexy niche, 20+ businesses, most sites outdated, you know the trade | "Pick the niche: pool cleaning, HVAC, or landscaping in Phoenix?" → *"pool cleaning"* |
| 2 — Research | **Design Blueprint Extractor** on an inspiration site you name (e.g. a clean SaaS-style home-services site) → `builderbrief.md`, `scaffold.html`, `tokens.json`. **Outlier Research** scrapes 12 pool companies → top 5 / bottom 5 → `outlier-anatomy.md` (winners: price-on-site, booking form, reviews above fold; losers: flash intros, no phone number) | "Approve the inspiration site and the outlier findings?" → *"yes, but keep the blue from the inspiration"* |
| 3 — Design tool | — | "Which tool: Stitch, AI Studio, Figma, Paper, or code-first?" → *"Stitch"* |
| 4 — Design | Section plan from the anatomy: hero + phone CTA, stat strip (years, pools serviced), plans grid, how-it-works, reviews, FAQ, quote form | "Review the design — approve before code?" → *"approve"* |
| 5 — Framework | — | "Framework?" → *"plain HTML/CSS + a bit of JS"* (client wants cheap hosting) |
| 6 — Build | Page(s) built 1:1 from the design, all content from `siteconfig.ts`; AI-generated hero image iterated until the pool photo leaves room for the headline | "Look at localhost — review before QA?" → *"looks good"* |
| 7 — QA | Conversion blueprint + UI/UX checklist: H1 "Pool Cleaning That Never Misses a Week" (6 words), AA contrast, form tested, mobile widths checked | "QA passed — approve?" → *"approve"* |
| 8 — Animation | You're told: **all motion goes to AnimotionJS** (Stage plan): hero reveal, scroll reveals, plan-card hover, counter on the stat strip → motion brief written and handed to the Animotion skill | "Animotion installed? Approve the motion brief?" → *"installed, approved"* |
| 9 — Deploy | — | "Deploy where: GitHub→Vercel, GoHighLevel, or WordPress?" → *"GitHub → Vercel"* |
| 10 — Sell | Runs the outreach system: scrapes Phoenix pool companies (Apify, budget-capped), enriches emails, then sends: *free site as the foot in the door* → hosting retainer ($50–150/mo) → SEO/reviews upsells; Day 1/3/7 follow-ups | "Draft the outreach emails for niche 'pool cleaning'?" → *"send to 20 leads"* |

**Result:** a deployed, converting site + a repeatable client-acquisition loop. The same `siteconfig.ts` makes the next local-business site a clone, not a rebuild.

---

## Scenario B — **Mode B — launch your own product (SaaS)**

**You say:**

> "I have a SaaS idea — FocusFlow, a focus timer with team accountability. I want to launch it."

**Mode:** B (novel idea / product launch — no customer list). Re-scopes Stages 1, 2's outliers, 4–7's goal, 3/5's surface, and 10's motion.

| Stage | What happens | The gate (you answer) |
|---|---|---|
| 0 — Intake | Agent records: idea ("FocusFlow — team focus timer"), audience (remote teams / ADHD founders), mode B, **brand assets collected**: existing teal logo + palette from your deck; **inspiration sites collected**: linear.app and stripe.com | "Confirm the idea and audience — and what brand assets exist?" → *"teal logo + palette; new type"* |
| 1 — Idea/audience validation | Re-scoped: who has this problem (r/ADHD, remote-work Discords), alternatives (Float, Motion, plain Pomodoro), demand signals (competitor reviews complaining about pricing) | "Audience confirmed: remote teams of 2–10?" → *"yes"* |
| 2 — Research | **Design Blueprint Extractor runs exactly like Mode A**: linear.app as inspiration (type scale, density, border language) + **second pass on your brand** (teal palette from the logo/deck) → merged: brand colors win, linear sets the feel → `builderbrief.md`, `scaffold.html`, `tokens.json`. **Outlier Research** re-scoped to rival launch pages (Motion, Forest, Pomodoro apps by traffic/reviews) → `outlier-anatomy.md` | "Approve the inspiration + extracted brand style?" → *"yes, keep #0D9488 as primary"* |
| 3 — Design tool | — | "Tool?" → *"code-first (Next.js)"* (multi-page app-like site) |
| 4 — Design | Section plan re-scoped to the product's anatomy: demo/video hero, feature grid, integrations logos, pricing tiers, testimonials, FAQ — single CTA: **Join the waitlist** | "Approve the design?" → *"approve"* |
| 5 — Framework | — | "Framework?" → *"Next.js"* — multi-page scaffold: `/`, `/pricing`, `/docs` |
| 6 — Build | Pages built from the outlier anatomy; AI-generated abstract hero matched to the teal palette; conversion goal wired: waitlist form (email only, no password) | "Review on localhost?" → *"approve"* |
| 7 — QA | Same checklists, goal adjusted: H1 "Focus Together, Finish Faster" (5 words), one CTA everywhere, form → provider tested, responsive pass | "QA passed?" → *"approve"* |
| 8 — Animation | Motion brief to AnimotionJS: hero mask reveal, feature-card scroll stagger, pricing hover lift, waitlist-button magnetic hover | "Animotion installed? Approve brief?" → *"approved"* |
| 9 — Deploy | — | "Deploy where?" → *"GitHub → Vercel + custom domain"* |
| 10 — Launch motion | Re-scoped from cold outreach: waitlist/launch email sequence, founder outreach (remote-work communities, r/SaaS), Product Hunt draft — same email rules (human subject, no hard ask, proof + link); monetization = trial/paid tiers instead of retainers | "Draft the launch emails and PH post?" → *"yes"* |

**Result:** a live multi-page product site with your brand DNA extracted alongside the inspiration, waitlist converting, and a launch sequence ready to send.

---

## What's identical in both modes

- Inspiration-site **design DNA extraction** and **brand-style extraction** (Stage 2)
- The conversion blueprint and QA checklists (Stage 7)
- Deployment (Stage 9)
- **The animation rule:** no motion code is ever written by this skill — Stage 8 hands a motion brief to the **AnimotionJS agentic skill** for all 15 supported agents
- A question gate at the end of every stage

Install for your agent: [INSTALL.md](./INSTALL.md).
