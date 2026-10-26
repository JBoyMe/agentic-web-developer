# Production runbook

Everything needed to ship **agentic-web-developer 2.3.x** and operate it afterwards: the private skill payload, the npm installer, the managed-credits proxy, Stripe, the local Blender engine, the QA matrix, monitoring and Rollback.

Read this top to bottom the first time. After that, use the [release checklist](#release-checklist) at the end.

---

## 0. What ships where

| Artifact | Contents | Lives at | How it updates |
|---|---|---|---|
| **Skill payload** (`skilltar.gz`) | `SKILL.md`, 11 departments, 25 references, templates, `assets/cineblock_ai_blender_addon.py` | Private immutable CDN URL in `package.json → awd.source` | Upload a **new** file, bump `awd.source`, publish a patch |
| **npm package** (`agentic-web-developer`) | `bin/install.js`, `commands/`, `docs/`, `README.md`, `package.json` | npm registry | `npm publish` |
| **Credits proxy** | `server/credits/` — Node ≥ 22.5, zero runtime deps, SQLite | Your VM / container + TLS host | Deploy a new image tag, restart |
| **Stripe** | Checkout sessions + webhook → credits | Stripe dashboard | Config only |

Hard rules:

- The npm tarball is **public forever**. It must never contain `skill/`, the proxy source, `.env`, or any secret. `scripts/release-check.js` enforces this.
- The payload URL is **immutable** — never overwrite an uploaded `skilltar.gz`. Old installs keep working only if the old URL keeps serving the old bytes.
- The proxy is the **only** writer of managed balances. The skill never receives `RENDERFUL_API_KEY`, `STRIPE_SECRET_KEY` or `FILE_SIGNING_SECRET`.
- Plans (Pro $7 / Studio $15 / Template $25) include **zero** credits. Credits are a separate prepaid purchase.

---

## 1. One-time preparation

### Accounts and keys

- [ ] npm account with publish rights to `agentic-web-developer` (2FA enabled).
- [ ] Renderful account → API key (`RENDERFUL_API_KEY`).
- [ ] Stripe account, **live** keys, webhook signing secret.
- [ ] A host for the proxy with a persistent volume and TLS (`credits.your-host`).
- [ ] The license validator reachable at `https://skills.animotion.click/api/license/validate`.
- [ ] A Blender 4.x install on the release machine (and on any machine you claim supports local 3D/video).

### Tools

- Node **24 LTS** (minimum 22.5; the proxy uses `node:sqlite`).
- `git`, `tar`, `curl`, `jq` (optional), `stripe` CLI (optional), `openssl`.
- Blender on `PATH` or `BLENDER_BIN` set.

### Repository sanity

```bash
git status --short          # know exactly what is being committed
node -v                     # >= 22.5 for proxy work
cd server/credits && npm test && cd ../..
```

Windows PowerShell equivalents work too; `scripts/release-check.js` handles `npm.cmd`.

---

## 2. Pre-flight: the release gate

Run from the repository root:

```bash
npm run release:check
```

It checks, in order:

1. `package.json` parses, has semver, and `awd.source` is an https `.tar.gz` URL.
2. Installer floor and proxy floor (`server/credits/package.json` → `engines.node >= 22.5`).
3. Payload content: `SKILL.md`, 11 departments, 25+ references, 10+ templates, the Blender add-on.
4. All 16 command sources → 31 installed names, valid frontmatter, `/awd-assets` proxy wording, no stale model ids.
5. **Pricing math**: every `$min–$max` row equals `ceil(usd / 0.05)`, and every model id is on the verified Renderful allowlist.
6. Proxy files, `node --check`, 60+ passing tests, `.env.example` keys with blank secrets.
7. Docs keep plans and credits separate; `docs/PRODUCTION.md` exists.
8. Hygiene: `.gitignore` tracks `package.json`/`commands/`/`server/`/`scripts/`; no secret patterns; `npm pack` leaks neither `skill/` nor `server/`.

Useful variants:

```bash
node scripts/release-check.js --no-tests   # skip the 60-test proxy suite
node scripts/release-check.js --json       # CI output, non-zero exit on failure
```

**Do not continue past a red check.** Every failure prints the file and the fix.

---

## 3. Payload: build, verify, upload

### 3.1 Bump the version once

```bash
npm version 2.3.1 --no-git-tag-version   # or edit package.json by hand
```

Version lives in `package.json` only. `build-skill.js` stamps it into the manifest.

### 3.2 Build

```bash
npm run release:build
```

Outputs:

```text
skilltar.gz                    ← upload this
dist/skill-<version>.json      ← sha256, size, file counts, current awd.source
```

Keep `dist/skill-<version>.json` with the release notes / upload record.

### 3.3 Verify the archive through the real installer

```bash
npm run release:verify
```

This installs `skilltar.gz` with `bin/install.js` into a throwaway HOME and asserts:

- the skill tree, 25+ references and the CineBlock add-on are present;
- `SKILL.md` still names the Asset Builder, credits and Blender references;
- all 31 slash commands exist, including `/awd-assets` and `/agentic-web-developer-assets`.

To test a URL instead of the local file (after upload):

```bash
node scripts/verify-release.js --source=https://your-cdn/skill-2.3.1.tar.gz
```

### 3.4 Upload to an immutable URL

Upload `skilltar.gz` to the private host. Use a new path per release, e.g. `…/skill-2.3.1.tar.gz`. Do **not** overwrite the 2.2.x file.

- [ ] Upload completed.
- [ ] `curl -sI <url>` returns `200` and a sane `Content-Length`.
- [ ] The URL works **without** cookies (private token, signed URL, or CDN auth as configured).
- [ ] SHA-256 of the downloaded file matches `dist/skill-<version>.json`.

### 3.5 Point `awd.source` at it

```jsonc
// package.json
"awd": {
  "source": "https://your-cdn/skill-2.3.1.tar.gz"
}
```

Verify the live upload through the installer:

```bash
node scripts/verify-release.js --source=https://your-cdn/skill-2.3.1.tar.gz
```

### 3.6 Deploy the same tree to the skills server (Google AI Studio + gated fetch)

The CDN payload and the skills-server payload are **two different consumers** of the same tree:

| Consumer | Reads | Updated by |
|---|---|---|
| Local agents via `npx agentic-web-developer install` | `awd.source` tarball | §3.4–3.5 |
| Google AI Studio + browser parity fetches | `https://skills.animotion.click/api/skills/agentic-web-developer/<path>` | **this step** |
| `npx` docs/commands | npm tarball | §4 |

`npm publish` does **not** update the skills server. Until the tree is deployed there, AI Studio (and any URL-Context-only client) keeps serving the previous release even when npm is current.

- [ ] Deploy the release `skill/` tree (same files that went into `skilltar.gz`) through the skills server's existing upload/deploy path.
- [ ] `references/ai-studio-system-prompt.md` on the server is the **new** router — paste-safe, with no credentials in it.
- [ ] Fetch through the gated route with a real key (GET), e.g.
      `curl -s "https://skills.animotion.click/api/skills/agentic-web-developer/references/ai-studio-system-prompt.md?licenseKey=$KEY" | grep -c "ASSET BUILDER"`
      → `1` on 2.3.x.
- [ ] `SKILL.md` on the server names the Asset Builder, credits and Blender references (same assertions as `npm run release:verify`).
- [ ] No stray `.env`, `dist/`, `server/`, or credential file is inside the deployed tree.
- [ ] Re-paste the router into AI Studio **System instructions** in a *new* chat and run the freshness check in `skill/references/google-ai-studio.md` → *Updates*.

> Admin secret hygiene: the router is published. It must never contain `AGENTIC_ADMIN_EMAIL`/`AGENTIC_ADMIN_SECRET` values or a real `sec_live_` key. `npm run release:check` fails on those patterns.

---

## 4. npm publish

```bash
npm whoami          # must print your npm user; a 401 means `npm login`
npm pack --dry-run  # expect 23 files: bin/, commands/, docs/, README, package.json
npm publish         # add --access public the first time / if config is lost
```

Post-publish checks:

```bash
npm view agentic-web-developer version
npm view agentic-web-developer dist.tarball
npx agentic-web-developer@<version> detect
```

Then a real install in a clean HOME:

```bash
npx agentic-web-developer@<version> install \
  --agent=opencode \
  --source=https://your-cdn/skill-2.3.1.tar.gz \
  --license-key=YOUR_TEST_KEY \
  --credits-url=https://credits.your-host \
  --home=/tmp/awd-npm-smoke
```

Confirm `~/.agentic-web-developer/config.json` was written and the skill directory + commands exist.

**Do not** publish from a dirty tree, and never `npm publish` a tarball that contains `skill/` or `server/` — the dry-run check above is mandatory.

---

## 5. Deploy the credits proxy

### 5.1 Host + TLS

1. VM (1–2 vCPU, 1 GB RAM is enough for the first hundreds of accounts) with a persistent disk.
2. DNS `credits.your-host` → VM.
3. Reverse proxy (Caddy or nginx) terminates TLS and forwards to `127.0.0.1:8787`. Keep the service bound to localhost when TLS is in front.
4. Set `TRUST_PROXY=true` **only** when that proxy overwrites `X-Forwarded-For`.

Caddy example:

```caddyfile
credits.your-host {
  reverse_proxy 127.0.0.1:8787
  request_body { max_size 2MB }
}
```

### 5.1a Render + Cloudflare (the deployed path)

`render.yaml` at the repo root describes the whole service: Docker build from
`server/credits`, a 1 GB disk at `/data`, `/health` as the check, and every non-secret env var.
Three secrets are marked `sync: false`, so Render prompts for them and they never enter Git.

1. Render → **New → Blueprint** → connect this repo → it detects `render.yaml`.
2. Fill the three prompted secrets:
   - `RENDERFUL_API_KEY` — the live key (server-side only, never in the skill)
   - `STRIPE_SECRET_KEY` — the **live** key from the account you already use
   - `STRIPE_WEBHOOK_SECRET` — leave `whsec_pending` for now; step 5 sets the real one
3. Deploy. The plan **must** be `starter` or higher: Render will not attach a disk to a free
   service, and without the disk the ledger resets on every deploy. Keep instances at **1** —
   SQLite is single-writer and two containers over one volume corrupt it.
4. Cloudflare DNS → `CNAME credits → awd-credits.onrender.com`, **Proxy status: DNS only (grey
   cloud)** for the first deploy, so Render can issue its certificate. Once `/health` answers over
   HTTPS, you can switch to Proxied (orange) with SSL/TLS mode **Full (strict)**.
5. Stripe → Developers → Webhooks → **Add endpoint**
   `https://credits.animotion.click/v1/stripe/webhook`, events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   Copy that endpoint's `whsec_…` into Render as `STRIPE_WEBHOOK_SECRET` and let it redeploy.
6. Verify from this repo, before telling anyone:

```bash
npm run check:deploy -- --url=https://credits.animotion.click
```

**Render specifics worth knowing:**

- The disk is mounted **root-owned** while the app runs as `node`, so the image starts as root only
  long enough for `deploy/entrypoint.sh` to chown the mount, then drops privileges. Without that the
  service dies at boot with `EACCES` on `credits.sqlite`.
- `PORT` is injected by Render at runtime. The image therefore does not hard-code it, and its
  HEALTHCHECK reads `${PORT:-8787}`.
- A disk prevents zero-downtime deploys and horizontal scaling — both are correct here; a deploy is
  a short restart.
- Bandwidth is metered (100 GB/mo included, then $0.10/GB). Outputs are up to 200 MB each, so watch
  this line if buyers generate long video. Signed URLs expire, which caps sharing but not re-downloads.
- If Stripe deliveries start failing with a Cloudflare `403`, disable **Bot Fight Mode** for the zone;
  Stripe's servers must reach the webhook path un-challenged.
- `TRUST_PROXY=true` is correct on Render: both Render's edge and Cloudflare overwrite
  `X-Forwarded-For`, so the rate limiter sees the real client IP.

### 5.2 Environment

```bash
cd server/credits
cp .env.example .env
openssl rand -hex 32   # FILE_SIGNING_SECRET
openssl rand -hex 32   # ADMIN_SECRET (operator grants)
```

Required in production (the service refuses to boot without them):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `RENDERFUL_API_KEY` | live Renderful key, server-side only |
| `FILE_SIGNING_SECRET` | 64 hex chars, unique per environment |
| `PUBLIC_BASE_URL` | `https://credits.your-host` (no trailing slash) |
| `LICENSE_VALIDATE_URL` | `https://skills.animotion.click/api/license/validate` |
| `DATA_DIR` | absolute path, e.g. `/data` |

Also set: `CREDIT_USD=0.05`, `LICENSE_SKILL=agentic-web-developer`, `LICENSE_PLAN=pro`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_SECRET`, `ALLOW_ORIGIN=https://skills.animotion.click`.

Leave `ALLOW_UNVERIFIED_LICENSES=false` — production validation rejects `true`.

Optional tuning: `MODELS_TTL_MS` (15 min), `*_TIMEOUT_MS` per asset type, `RATE_LIMIT_PER_MIN=60`, `MAX_OUTPUT_BYTES=209715200`, `FILE_URL_TTL_SEC=3600`.

### 5.3 Run it

Direct:

```bash
cd server/credits
npm start
curl -s localhost:8787/health | jq
```

Docker:

```bash
cd server/credits
docker compose up -d --build
docker compose ps
docker compose logs -f credits
```

Health must report `ok: true`, `renderful: true`, `stripe: true`, `stripeWebhook: true`, `licenseValidation: true`, `packs: 4`.

### 5.4 First live smoke test

Verify the deployment before you announce it. Two commands, no spend:

```bash
# 1. Is the .env fit to deploy? (catches placeholders, test keys, wrong hosts)
npm run check:deploy -- --env=server/credits/.env

# 2. Is the running deployment actually the code you think it is?
npm run check:deploy -- --url=https://credits.your-host
```

The live mode asserts `/health`, pack prices, the licence gate (401), the admin gate (401), both
post-checkout pages (HTML + `no-store`), the webhook route (400 on a forged signature — not 404 and
not 503), signed-file rejection (403), and that an unknown path returns the proxy's JSON 404 rather
than a host page. Run it after every deploy: the 404 it checks for is exactly the bug that shipped
once already, and it is invisible until a buyer has paid.

Then exercise the API with a real licence key:

```bash
BASE=https://credits.your-host
KEY=YOUR_TEST_LICENSE_KEY

curl -s "$BASE/v1/credits/packs" | jq
curl -s "$BASE/v1/credits/models?kind=image" | jq '.models[:3]'
curl -s "$BASE/v1/credits/balance" -H "x-license-key: $KEY" | jq

curl -sX POST "$BASE/v1/credits/quote" \
  -H "x-license-key: $KEY" -H "content-type: application/json" \
  -d '{"type":"text-to-image","model":"flux-dev","prompt":"test"}' | jq

curl -sX POST "$BASE/v1/credits/generations" \
  -H "x-license-key: $KEY" -H "content-type: application/json" \
  -H "Idempotency-Key: smoke-$(date +%s)" \
  -d '{"type":"text-to-image","model":"flux-dev","prompt":"a calm gradient sky"}' | jq
```

Poll `GET /v1/credits/generations/:id` until `completed`; download the signed URL **before** `expiresIn` runs out. Re-request the job to mint a fresh URL.

Grant a test balance (no Stripe needed):

```bash
curl -sX POST "$BASE/v1/admin/grant" \
  -H "x-admin-secret: $ADMIN_SECRET" -H "content-type: application/json" \
  -d '{"accountId":"acct_REPLACE","credits":20,"note":"smoke test","idempotencyKey":"smoke-01"}' | jq
```

### 5.5 Persistence and boot behaviour

- `DATA_DIR/credits.sqlite*` (WAL) holds accounts, ledger, jobs, intents, webhook ids.
- `DATA_DIR/files/` holds generated outputs.
- `DATA_DIR/renderful-models.json` is a 15-minute model-cache snapshot.
- `schema.sql` is applied idempotently at boot; there is no separate migration step.
- Mount `DATA_DIR` on a real volume. Docker Compose uses the `credits-data` volume; back that up, not the container.

---

## 6. Stripe

The proxy creates Checkout Sessions with **dynamic `price_data`** from its own pack catalogue — you do **not** need to create Stripe Products/Prices.

1. Stripe dashboard → Developers → API keys → copy the **secret** key into `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → **Add endpoint**:
   - URL: `https://credits.your-host/v1/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Restart the proxy; `GET /health` must show `stripe: true` and `stripeWebhook: true`.
4. Local test:

```bash
stripe login
stripe listen --forward-to localhost:8787/v1/stripe/webhook
```

5. **Full end-to-end test (test mode, $0).** Do this before launch and after any change to the
   checkout, webhook or ledger code:

```bash
# one time: paste a TEST-mode key into server/credits/.env.qa
#   Dashboard -> Developers -> API keys -> toggle "Test mode" -> copy sk_test_…
npm run qa:stripe
```

`qa:stripe` starts `stripe listen` to capture a real `whsec_`, boots the proxy with it, creates a
Starter session, prints a `PAY NOW →` URL, and waits. Pay with `4242 4242 4242 4242`, any future
expiry, any CVC. It then asserts that Stripe echoes our amount/currency/metadata/success and cancel
URLs, that Stripe's own signed webhook granted exactly 100 credits, that the ledger holds one
`purchase` row, that the landing page says the credits are in the balance, and that a refund leaves
the balance untouched. The harness refuses `sk_live_`/`rk_live_` keys outright.

**Post-checkout pages:** the proxy serves `GET /checkout/success?session_id=…` and
`GET /checkout/cancel` itself (public, HTML, `no-store`, `default-src 'none'` CSP). The success page
names the pack and credit count and refreshes every 3s until the webhook lands, so a buyer never sees
a 404 and never has to guess whether the grant arrived. If you set `STRIPE_SUCCESS_URL` /
`STRIPE_CANCEL_URL` to your store's own pages instead, the proxy serves nothing after payment and the
store is responsible for confirming the grant.

6. Production verification: buy the cheapest pack with a real card, confirm the ledger entry `purchase +100`, then refund it in Stripe (see policy below).

**Webhook guarantees:** signature verified against the raw body, timestamp tolerance `STRIPE_TOLERANCE_SEC`, deduped by event id, amount checked against the pack price, and one grant per checkout intent. A wrong `STRIPE_WEBHOOK_SECRET` returns `400 Invalid Stripe signature`; a rewritten body (compression middleware) produces the same error.

**Refund policy:** a Stripe refund does **not** automatically claw back credits. Decide the policy before launch. Default recommendation: refunds within 7 days only if unused; for used credits, refund the unused remainder as goodwill. The admin API only grants positive credits, so a correction requires a manual, backed-up SQL update or an account-level block.

---

## 7. Blender (0-credit engine)

The Asset Builder uses local headless Blender for block-animation video and full 3D (mesh → UV → PBR → lights → keyframes → Draco `.glb`). These renders never touch the proxy and spend **0 credits**.

### Release-machine check

```bash
blender --version
# or
export BLENDER_BIN=/path/to/blender
"$BLENDER_BIN" --version
```

If Blender is missing, the skill must fall back (cloud 3D mesh, user file, SVG, skip) rather than fail. That fallback is part of QA below.

### Add-on install

```bash
# Linux
mkdir -p ~/.config/blender/4.*/scripts/addons
cp skill/assets/cineblock_ai_blender_addon.py ~/.config/blender/4.*/scripts/addons/
```

On macOS/Windows use the equivalent Blender user-scripts path. Enable **CineBlock AI** in Preferences → Add-ons, or install the `.py` through the UI.

### Headless smoke test

```bash
npm run qa:blender                              # finds Blender automatically
BLENDER_BIN="/path/to/blender" npm run qa:blender   # explicit binary
npm run qa:blender -- --keep                    # keep frames + .glb in .blender-smoke/
```

`scripts/qa-blender.mjs` locates Blender (env → `PATH` → the usual Windows/macOS/Linux install
paths), then runs `scripts/blender-smoke.py` which loads the add-on, builds a camera rig with the
deterministic operator, renders three frames of a small blockout, and exports a Draco `.glb`. The
wrapper then re-parses the GLB in Node and asserts:

- [x] Blender runs headless;
- [x] the add-on registers and reports its version;
- [x] the rig operator finishes, adds a `TRACK_TO` constraint and DOF focus, and keyframes the camera;
- [x] three non-empty PNG frames are written to the output folder;
- [x] the `.glb` is a valid glTF 2 binary with meshes, and declares `KHR_draco_mesh_compression`
      as used *and* required;
- [x] the add-on contains no network/subprocess code, so the local engine cannot spend credits.

Verified 2026-10-26 on **Blender 5.0.1** (Python 3.11.13, Windows): 7/7 checks, 3 frames ≈ 48 kB
each, 3,140-byte Draco GLB loaded by **three.js r169** in a real browser (`GLB_OK`, 3 meshes, 52
vertices, `KHR_draco_mesh_compression`). Blender ≥ 4.4 uses slotted Actions; the smoke script reads
both the legacy `action.fcurves` and the newer `layers/strips/channelbags` shape.

Blender is optional at runtime. If it is missing, the skill must fall back (cloud 3D mesh, user file,
SVG, skip) rather than fail — do not add `qa:blender` to CI on a runner without Blender. Re-run this
check on every OS you claim to support and after any Blender major upgrade.

---

## 8. End-to-end QA

Run the matrix before every public release, and at least monthly against production.

### 8.0 Automated coverage (no spend, no live Stripe)

Five scripts run the parts of the matrix that do not need a real card or a paid generation:

```bash
npm run qa:credits    # real proxy HTTP + SQLite against a local fake Renderful
npm run qa:catalog    # read-only drift check against the live Renderful catalogue
npm run qa:blender    # headless add-on + rig + render + Draco GLB (needs Blender, optional)
npm run qa:stripe     # real Stripe test-mode checkout -> webhook -> grant -> refund
npm run qa            # unit tests + credits + catalog (no Blender/Stripe required)
```

`qa:stripe` is the only one that talks to Stripe. It needs the Stripe CLI, a test-mode secret key in
`server/credits/.env.qa`, and one manual card entry (`4242 4242 4242 4242`). It proves the pieces the
offline harness cannot: that Stripe accepts our session parameters, that a real Stripe-signed webhook
reaches the proxy and grants the pack, that the buyer's landing page confirms it, and that a refund
does not move the balance. It hard-refuses live keys, so it cannot charge money.

`qa:credits` boots the actual proxy (`createApp`, real DB, pricing, storage, signed URLs, Stripe
signature verifier) on an ephemeral port with `RENDERFUL_BASE` pointed at a fake upstream whose USD
ranges match the live catalogue. It asserts, in order: health/pack/catalogue shape; unknown model and
type rejection; min–max quote and reserve-max; `402 payment_required` on a zero balance with no
ledger row; `401` without a licence key; admin-grant auth and idempotency; reserve before submit;
`Idempotency-Key` replay; on-demand polling; output download; settle with no drift; refund of the
quote difference; overage settle above the quote; full refund on provider failure and on output
download failure; signed URL `200`/`HEAD`/`Range 206`; tampered, expired and traversal paths refused;
job re-read re-signing a working URL; concurrent jobs never overdrawing; and every Stripe webhook
branch (grant, replay by event id, second event for a paid intent, `client_reference_id`, bad
signature, stale timestamp, rewritten body, amount mismatch, unpaid session, missing/unknown intent,
unrelated event). It fails the process on any assertion.

`qa:catalog` parses the Image/Audio/3D/Video tables in `skill/references/asset-credits.md` plus the
`VERIFIED_MODELS` allowlist in `scripts/release-check.js`, then compares each id with
`GET https://api.renderful.ai/api/v1/models`: id present for that media kind, live `cost.min/max`
equal to the documented range, and documented credits equal `ceil(usd / $0.05)`. Run it after any
Renderful catalogue change; `--tolerance=0.05` relaxes the price comparison.

Last run (2026-10-26): `qa:credits` **33/33**, `qa:catalog` **23/23 documented models**, 580 live
models (575 priced), `qa:blender` **7/7** on Blender 5.0.1, `qa:stripe` **9/9** (test mode: session
accepted, real webhook delivered, `purchase +100`, landing page confirmed, refund honoured),
compatible with `node:sqlite` on Node 25.9.

What still needs a human before launch:

| Check | Why it cannot be automated here |
|---|---|
| Real checkout in **test mode**: `npm run qa:stripe`, pay `4242…`, watch `purchase +100`, refund | needs a test-mode key and one card entry; automatable but not unattended |
| One live purchase with a real card, then refund | proves the live account end to end; costs Stripe's non-refundable fee and leaves an unrevokable grant |
| Stripe dashboard webhook delivery to the deployed proxy | needs a public HTTPS endpoint registered in Stripe |
| One paid generation per kind (image/audio/video/3D) | spends real Renderful credit; quote-only checks prove the pricing path |
| Blender on each supported OS | `qa:blender` automates the render + GLB on one machine; repeat on macOS/Linux |

### 8.1 Install + entry points

| Case | Expected |
|---|---|
| Fresh HOME, `--agent=opencode`, remote payload | skill + 31 commands installed, `detect` says `INSTALLED` |
| `--home` throwaway + `--force` | idempotent reinstall |
| `--credits-url=https://credits.your-host` | `~/.agentic-web-developer/config.json` has `creditsApiUrl` |
| `--credits-url=ftp://…` | installer rejects the URL |
| Bad/expired license | gate blocks skill stages; `/awd-assets` never bypasses the gate |
| Valid Template key | passes the same gate; does **not** unlock credits |

Entry points: `/awd-assets` · Design **4.3** · Mode E **E.3** · Mode C asset protocol · a plain request in Modes A/B/D.

### 8.2 Transports

| Setup | Expected |
|---|---|
| `AWD_CREDITS_API_URL` set | managed calls only; no `RENDERFUL_API_KEY` requested |
| No proxy URL, `RENDERFUL_API_KEY` set | direct Renderful; local balance file used |
| Neither | no cloud generation; Blender / user file / SVG / skip |
| Proxy configured **and** a key set | proxy wins; key ignored |
| `AWD_CREDITS_API_URL` empty string | ignored; config file / direct path used |

### 8.3 Credit paths

The first twelve items below are asserted end-to-end by `npm run qa:credits` (§8.0); the checkout
link, live Stripe delivery and a real paid generation remain manual.

- [ ] Balance 0 → quote shows the range and the shortfall → gate offers a pack → checkout link works.
- [ ] `402 payment_required` on create when balance < max reservation.
- [ ] Reserve = **max**, settle = actual, difference refunded (`reserve` then `settle`/`refund` in history).
- [ ] Provider failure → full refund, status `failed`, `charged: 0`.
- [ ] Timeout (per asset type) → full refund.
- [ ] Output download failure → full refund.
- [ ] Same `Idempotency-Key` twice → one job, `replay: true`, no double charge.
- [ ] Two concurrent jobs with only enough balance for one → one succeeds, one `402`; never a negative balance.
- [ ] Unknown model id → rejected (unless `ALLOW_UNKNOWN_MODELS=true`, which production must not use).
- [ ] Signed URL after expiry → `403`; re-read the job → fresh URL works.
- [ ] Video `Range` request → `206` with correct bytes.
- [ ] Stripe webhook replayed → no double credit; amount mismatch → ignored.
- [ ] Local/BYO mode: deduct only after a successful download; write the refund on failure.

### 8.4 Asset coverage

| Kind | Managed test | Local test |
|---|---|---|
| Image | `flux-dev` text→image | — |
| Voice | `speech-2.6-turbo` | — |
| Music/SFX | `music-2.5` / text-to-audio | — |
| Video | `wan-2.6` (10–20 cr) text→video | Blender blockout + optional AI pass |
| 3D | `hunyuan3d-v3` mesh (8–30 cr) | full procedural 3D with materials + animation |
| SVG | — | procedural fallback |

### 8.5 Ingest and playback QA

- [ ] File lands at the exact slot path, correct extension and codec.
- [ ] Image optimized (WebP where appropriate); video muted/loop/poster; audio has controls; `.glb` uses Draco and loads in the target viewer.
- [ ] Budgets respected (hero video size/duration; total page weight).
- [ ] `prefers-reduced-motion` and keyboard fallbacks exist.
- [ ] Controls (play/scrub, orbit/zoom/reset, mute, scroll-linked rates) were briefed to Animotion Studio, not hand-rolled.
- [ ] `build-state.md` records route, model, reserved/charged credits and balance after.

### 8.6 Failure ladder (must never block)

For each of: no proxy, proxy 5xx, validator down, empty balance, Renderful down, no Blender, bad model id — the skill must offer a cheaper model (re-gated), smaller batch, buy credits, user file, keep existing, SVG, or skip.

---

## 9. Monitoring and operations

### Health and alerts

- `GET /health` every 30 s; alert on non-2xx, `ok != true`, or a configured integration flipping to `false`.
- Alert on 5xx rate, `402` spikes (pricing/balance bug or abuse), webhook 4xx, job failures > 5%, and disk > 80%.
- Watch SQLite: `credits.sqlite-wal` growth, `database is locked` errors, volume latency.
- Log lines are structured JSON (`LOG_LEVEL=info`); bearer tokens and Stripe keys are redacted.

### Backups (nightly, and before every deploy)

```bash
# consistent SQLite copy (service may keep running)
sqlite3 "$DATA_DIR/credits.sqlite" ".backup '/backups/credits-$(date +%F).sqlite'"

# outputs
rsync -a "$DATA_DIR/files/" "/backups/files-$(date +%F)/"
```

Restore drill (quarterly): stop the service, restore DB + files to a scratch `DATA_DIR`, boot on another port, check `balance` and one signed URL. A backup you have not restored is not a backup.

### Reconciliation

- Daily: sum `reserve/settle/refund` per day from `/v1/credits/history` (or SQL) against Renderful spend. Differences mean pricing or settlement drift.
- Weekly: Stripe payouts vs `purchase` ledger entries.
- On a price change: refresh models (`GET /v1/credits/models`), sanity-check the quoted range for the default models, and update the skill's price tables only when Renderful's catalog changes (the release gate enforces the math).

### Operator tasks

| Task | How |
|---|---|
| Manual top-up / support credit | `POST /v1/admin/grant` with `x-admin-secret`, positive integer credits, stable `idempotencyKey` |
| Fallback checkout paid externally | Verify payment, then grant with the order id as the idempotency key |
| Stuck job | Check `/health` and logs; jobs fail + refund at their type timeout. Never edit balances by hand |
| Suspected key leak | Rotate the license key at the validator; the proxy derives accounts from the key, so the old account stops authenticating |
| Secret rotation | Update `.env`, restart; rotate `FILE_SIGNING_SECRET` last (it invalidates outstanding file URLs) |

### Scaling notes

One process + SQLite is right for a small business. Before running replicas: move the ledger to Postgres, use a shared output store (S3/R2) with signed URLs, and put the rate limiter at the edge. Do not mount one SQLite file on two writers.

---

## 10. Rollback

### Skill payload (bad content, bad references)

1. Put the previous `awd.source` URL back in `package.json` (old payloads are immutable and still online).
2. Publish a **patch** npm version (e.g. `2.3.2`) — npm versions are permanent.
3. Tell affected users: `npx agentic-web-developer@latest install --force`.
4. Only delete the bad payload file after the previous URL is restored everywhere.

### npm package (bad installer)

```bash
npm dist-tag add agentic-web-developer@2.2.1 latest   # move `latest` back
npm deprecate agentic-web-developer@2.3.1 "broken installer — use 2.2.1 or 2.3.2"
```

You cannot unpublish after 72 hours; a deprecated version + a fixed patch is the Rollback path.

### Credits proxy

1. `git checkout <previous-tag>` and redeploy, or deploy the previous image tag.
2. `schema.sql` is additive/idempotent — no down-migration is needed for the current schema.
3. If data is corrupted: stop the service, restore the last DB + files backup together, restart, then replay missing Stripe events from the dashboard (idempotent by event id).
4. If Renderful is the problem: the proxy keeps serving balances/history; new generations return upstream errors and refund. The skill should fall back to Blender/user files.

### Stripe

- Disable a misbehaving webhook endpoint in the dashboard (events stay queued for a while) or rotate `STRIPE_WEBHOOK_SECRET` and restart.
- Refund charges in Stripe, then reconcile credits per policy. Never bulk-edit balances without a fresh backup.

### Blender

Local renders are ephemeral and cost 0 credits. If an add-on regression ships, the skill falls back to cloud 3D / user files / SVG. Roll back the payload as above.

---

## 11. Incident playbooks

| Symptom | First move |
|---|---|
| Every generation `503 Could not verify your license` | Validator down and no cached grant. Restore the validator; do **not** flip `ALLOW_UNVERIFIED_LICENSES` in production |
| `402` for everyone | Pricing/catalog change made the reservation larger than balances; check `/v1/credits/models`, `CREDIT_USD`, `PRICING_BASIS` |
| Jobs stuck `queued` | Renderful latency or a rejected key at create. Check logs/`/health`; timeouts refund automatically |
| Signed URLs `403` | Expired or `FILE_SIGNING_SECRET` rotated. Re-read the job for a fresh URL |
| Webhook `400 Invalid Stripe signature` | Wrong secret, or a proxy rewrote the raw body |
| Credits double-granted | Stop the webhook endpoint, inspect ledger/intents; dedupe by event and intent id. Restore from backup if the ledger is inconsistent |
| Proxy disk full | Generated files fill `DATA_DIR/files/`. Apply a retention job (e.g. delete completed job files older than 30 days after delivery), then expand the volume |

---

## 12. Release checklist

Copy this into the release issue and tick it.

**Build**

- [ ] `npm run release:check` green (tests included)
- [ ] `package.json` version bumped
- [ ] `npm run release:build` → `skilltar.gz` + `dist/skill-<version>.json`
- [ ] `npm run release:verify` green
- [ ] `npm pack --dry-run` → 23 files, no `skill/`, no `server/`

**Publish**

- [ ] New payload URL uploaded, SHA matches, `verify-release --source=<url>` green
- [ ] `awd.source` updated and committed
- [ ] Skills-server tree deployed (§3.6); gated router fetch contains `ASSET BUILDER`
- [ ] AI Studio router re-pasted in a new chat; freshness check passes
- [ ] `npm publish` done; `npm view … version` matches
- [ ] Clean-HOME `npx … install` smoke test (skill + commands + credits config)
- [ ] Git tag + GitHub release with the payload SHA and the changelog

**Deploy**

- [ ] Proxy `.env` complete; production validation passes
- [ ] `/health` shows renderful + stripe + stripeWebhook + licenseValidation + 4 packs
- [ ] Stripe webhook endpoint live and a test purchase credits the balance
- [ ] Blender smoke test on the release machine; fallback verified without Blender
- [ ] Backup taken before deploy; restore drill current

**QA**

- [ ] Transport matrix (managed / BYO / none) green
- [ ] Credit paths: gate, 402, reserve/settle/refund, idempotency, concurrency, expiry
- [ ] Image, voice, music/SFX, video, 3D, SVG all exercised
- [ ] Playback + reduced motion + budgets checked
- [ ] Failure ladder offers a fallback in every no-X case

---

## Appendix A — environment reference

### Proxy

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | — | `production` enables strict config validation |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | Bind localhost when TLS is terminated in front |
| `PUBLIC_BASE_URL` | — | Required; used in signed file URLs |
| `DATA_DIR` | `./data` | SQLite + files + model cache |
| `RENDERFUL_API_KEY` | — | Required for generation |
| `RENDERFUL_BASE` | `https://api.renderful.ai/api/v1` | Override only for a proxy |
| `CREDIT_USD` | `0.05` | 1 credit = $0.05 of raw spend |
| `PRICING_BASIS` | `max` | Reserve the max of the quote |
| `ALLOW_UNKNOWN_MODELS` | `false` | Never enable in production |
| `LICENSE_VALIDATE_URL` | — | Required |
| `LICENSE_SKILL` / `LICENSE_PLAN` | `agentic-web-developer` / `pro` | Validator request |
| `LICENSE_CACHE_MS` | `3600000` | Positive/negative cache |
| `STRIPE_SECRET_KEY` | — | Enables Checkout |
| `STRIPE_WEBHOOK_SECRET` | — | Enables `/v1/stripe/webhook` |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | store URLs | Checkout redirects |
| `CHECKOUT_FALLBACK_URL` | store URL | Manual mode when Stripe is absent |
| `FILE_SIGNING_SECRET` | — | Required; 32 random bytes (hex) |
| `FILE_URL_TTL_SEC` | `3600` | Signed-URL lifetime |
| `MAX_OUTPUT_BYTES` | `209715200` | Output size cap |
| `ADMIN_SECRET` | — | Enables `/v1/admin/grant` |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_PER_MIN` | `true` / `60` | In-memory, per process |
| `POLL_INTERVAL_MS` / `MAX_POLL_BATCH` | `5000` / `5` | Background job poller |
| `TIMEOUT_*_MS` | image 120s · audio 180s · 3D 300s · video 600s | Failure → refund |

### Client

| Variable | Purpose |
|---|---|
| `AWD_CREDITS_API_URL` | Managed proxy base URL (wins over the config file) |
| `AWD_CREDITS_CHECKOUT_URL` | Override the static purchase link |
| `AGENTIC_LICENSE_KEY` / `ANIMOTION_LICENSE_KEY` | License key for the gate + proxy auth |
| `RENDERFUL_API_KEY` | Direct/BYO mode only |
| `AWD_CREDIT_BALANCE` | CI override for the local balance |
| `BLENDER_BIN` | Blender executable when not on `PATH` |

---

## Appendix B — versioning policy

- **Patch** (`2.3.x`): wording, price-table refresh, fallback catalog, proxy fixes that don't change the API.
- **Minor** (`2.x.0`): new references/commands/models, additive proxy routes, new packs.
- **Major** (`3.0.0`): payload layout, installer flags, proxy contract or ledger schema breaking changes.

Every release: bump `package.json` → rebuild payload → new immutable URL → `npm publish` → deploy proxy if `server/credits` changed → run the QA matrix → tag.
