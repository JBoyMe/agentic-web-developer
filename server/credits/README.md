# AWD credits proxy

The managed-credits service behind the Asset Builder. It keeps the Renderful API key on the
server, binds a prepaid credit balance to a license key, prices generations from Renderful's live
catalog, meters the real cost, refunds failures and the quote difference, sells packs through
Stripe Checkout, stores outputs privately and serves them through signed URLs.

The skill in the user's session never sees `RENDERFUL_API_KEY` and never writes a balance file that
matters. It calls this proxy; this service is the source of truth.

- Node **≥ 22.5** (uses `node:sqlite`, `fetch`, `node:test`) — Node 24 LTS recommended.
- Zero runtime dependencies.
- Single process, SQLite in WAL mode. Good for one small VM; scale up before scaling out.

```text
skill session ──license key──▶ credits proxy ──Bearer key──▶ Renderful /generations
     ▲                              │
     └──── signed file URLs ────────┘        Stripe ──webhook──▶ credits proxy
```

## Quick start

```bash
cd server/credits
cp .env.example .env
# fill RENDERFUL_API_KEY, FILE_SIGNING_SECRET, PUBLIC_BASE_URL, LICENSE_VALIDATE_URL
node src/server.mjs          # reads .env automatically (real env vars win)
curl -s localhost:8787/health | jq
```

`src/server.mjs` calls `process.loadEnvFile` on `./.env` (override with `ENV_FILE`), so the
`cp` above is enough — no `export`/dotenv step. A missing file is ignored.

Generate the two secrets with `openssl rand -hex 32`. `FILE_SIGNING_SECRET` is mandatory;
`ADMIN_SECRET` enables operator grants.

Docker:

```bash
docker compose up -d --build
docker compose logs -f credits
```

## Pricing model

`GET /models` on Renderful returns a USD **range** per model (`cost.min` … `cost.max`). Renderful
returns the **actual** `cost` when a generation is created, so the proxy:

1. quotes `ceil(usd / CREDIT_USD)` for both ends and shows the user a **min–max credit range**;
2. requires and reserves the **max** (configurable with `PRICING_BASIS=min`, not recommended);
3. debits the reservation atomically before calling Renderful;
4. when the job completes, settles against the actual `cost` — refunds the difference, or charges
   the small overage if the model charged above the quote (only up to the current balance);
5. refunds the full reservation on failure, timeout, or a failed output download.

`1 credit = $0.05` of raw spend. Packs are sold at $0.063–$0.070 per credit, so the gross margin is
the spread. The catalog is cached in `DATA_DIR/renderful-models.json` for 15 minutes and falls back
to a bundled snapshot if Renderful is down. Unknown models are rejected unless
`ALLOW_UNKNOWN_MODELS=true` — the skill must never invent a model id.

### Packs

Default catalogue (override with `CREDIT_PACKS_JSON`):

| id | credits | price |
|---|---|---|
| `starter` | 100 | $7 |
| `builder` | 300 | $21 |
| `production` | 1,000 | $65 |
| `agency` | 3,000 | $189 |

## API

All `/v1/credits/*` routes except `packs` and `models` require a license key:

```
x-license-key: <key>
# or: Authorization: Bearer <key>
```

The account is derived as `sha256(licenseKey)`; the raw key is never stored. Validation responses
are cached for `LICENSE_CACHE_MS`, and a previously valid key keeps working through a validator
outage (grace) while an unknown key does not.

### `GET /health`

No auth. Reports which integrations are configured — never their values.

### `GET /v1/credits/packs`

No auth. `{ packs: [{id,name,credits,priceCents,price,perCredit}], creditUsd }`.

### `GET /v1/credits/models?kind=image|audio|video|3d&q=`

No auth. Catalog with `credits: {min,max}` per model — the same allowlist and price list the skill
shows in a gate.

### `GET /v1/credits/balance`

```json
{ "accountId": "acct_…", "balance": 240, "creditUsd": 0.05 }
```

### `GET /v1/credits/history?limit=50`

`{ entries: [{id,op,credits,balance_after,job_id,pack_id,note,created_at}] }`.
`op` is one of `purchase`, `reserve`, `refund`, `settle`, `admin`.

### `POST /v1/credits/quote`

Prices without spending:

```json
{ "type": "text-to-video", "model": "wan-2.6", "num_outputs": 1 }
```

```json
{
  "quote": {
    "model": "wan-2.6", "type": "text-to-video", "name": "WAN 2.6",
    "known": true, "basis": "max", "numOutputs": 1, "creditUsd": 0.05,
    "usd": { "min": 0.5, "max": 1 },
    "credits": { "min": 10, "max": 20, "reserved": 20 },
    "source": "renderful-catalog"
  },
  "balance": 240,
  "affordable": true,
  "shortfall": 0,
  "packs": [ … ]
}
```

### `POST /v1/credits/generations`

Body is Renderful's `GenerationRequest` (`type`, `model`, `prompt`, optional `image_url`,
`duration`, `aspect_ratio`, `resolution`, `num_outputs`, …). Add `Idempotency-Key` to make retries
safe.

```bash
curl -sX POST "$BASE/v1/credits/generations" \
  -H "x-license-key: $KEY" -H "content-type: application/json" \
  -H "Idempotency-Key: hero-001" \
  -d '{"type":"text-to-image","model":"flux-dev","prompt":"minimal clinic hero, warm light"}'
```

`202` returns `{ job, replay: false }`:

```json
{
  "job": {
    "id": "job_…", "status": "queued", "type": "text-to-image", "model": "flux-dev",
    "credits": { "min": 1, "max": 2, "reserved": 2, "charged": null },
    "providerCostUsd": 0.1, "outputs": [], "error": null,
    "createdAt": "…", "updatedAt": "…", "completedAt": null
  }
}
```

If the balance is below the reservation the response is `402 payment_required` with
`{ balance, required }`.

### `GET /v1/credits/generations/:id`

Polls on demand when the job is stale, then returns the job. Completed outputs are signed URLs:

```json
{
  "job": {
    "id": "job_…", "status": "completed",
    "credits": { "min": 1, "max": 2, "reserved": 2, "charged": 2 },
    "providerCostUsd": 0.1,
    "outputs": [{
      "name": "1.png",
      "url": "https://credits.example.com/files/acct_…/job_…/1.png?exp=…&sig=…",
      "bytes": 842311, "contentType": "image/png", "expiresIn": 3600
    }]
  }
}
```

Statuses: `submitting` → `queued` → `processing` → `storing` → `completed`, or `failed`.
A failed job has `charged: 0` and its reservation refunded.

### `GET /v1/credits/generations?limit=20`

Recent jobs for the calling account. The signed URLs follow the same contract.

### `POST /v1/credits/checkout`

```json
{ "packId": "builder", "email": "buyer@example.com" }
```

With Stripe configured: `{ intentId, provider: "stripe", url, sessionId, pack }`. Redirect the user
to `url`; credits are applied by webhook, not by the redirect.

Without Stripe but with `CHECKOUT_FALLBACK_URL`: an `external` intent and the fallback link, with
`creditedAutomatically: false` — an operator must credit the account manually.

### `POST /v1/stripe/webhook`

Raw-body Stripe webhook. Verifies `Stripe-Signature` (HMAC-SHA256, timestamp tolerance), dedupes by
event id, checks `amount_total` against the pack price, and credits the account once per checkout
intent. Handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`;
`completed` with `payment_status != paid` waits for the async event.

### `POST /v1/admin/grant`

```bash
curl -sX POST "$BASE/v1/admin/grant" \
  -H "x-admin-secret: $ADMIN_SECRET" -H "content-type: application/json" \
  -d '{"accountId":"acct_…","credits":100,"note":"manual top-up","idempotencyKey":"ticket-42"}'
```

Returns `{ accountId, balance, credited, replayed }`. Use it to honour a fallback checkout or a
support ticket; the `idempotencyKey` prevents double-grants.

### `GET /files/<account>/<job>/<file>?exp=…&sig=…`

Signed, expiring output delivery with `Range` support (video scrubbing). The signature covers the
path and expiry; changing either returns `403`. Files are never listed publicly.

## Deploy

1. **VM** with a persistent volume mounted at `DATA_DIR` (SQLite + generated files).
2. Reverse proxy (nginx/Caddy) terminating TLS for `PUBLIC_BASE_URL`, forwarding to `:8787`,
   client body limit ≥ `MAX_OUTPUT_BYTES` for uploads if you enable them.
3. Set `TRUST_PROXY=true` only when a trusted proxy overwrites `X-Forwarded-For`.
4. Stripe → Developers → Webhooks → add `https://<host>/v1/stripe/webhook`, subscribe to
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`, put the signing
   secret in `STRIPE_WEBHOOK_SECRET`.
5. Health check: `GET /health` every 30 s.
6. Run migrations automatically at boot (the service applies `schema.sql` idempotently) and back up
   `DATA_DIR/credits.sqlite*` + `DATA_DIR/files/` together.

### Security checklist

- `RENDERFUL_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FILE_SIGNING_SECRET`,
  `ADMIN_SECRET` live only in the server environment. The skill never receives them.
- Logs redact bearer tokens and Stripe keys; license keys are never logged or stored.
- Signed file URLs are bearer credentials — treat them like the asset; keep the TTL short.
- The proxy is the only writer of balances. Do not mount the database into the skill container.
- Rate limit at the proxy (`RATE_LIMIT_PER_MIN`) and at the edge. The in-memory limiter is
  per-process; use an edge limiter if you run replicas.
- `ALLOW_UNVERIFIED_LICENSES` is a development switch; production config validation rejects it.

## Tests

```bash
cd server/credits
npm test          # unit + in-process HTTP tests (no network, no spend)
npm run qa        # end-to-end: real proxy HTTP + SQLite against a fake Renderful
npm run qa:catalog  # read-only drift check against the live Renderful catalogue
```

`npm run qa` boots the real proxy on an ephemeral port with a local fake upstream and drives
quote → 402 gate → admin grant → reserve → poll → settle/refund (including overage, upstream
failure and output-download failure) → signed URL (Range, tamper, expiry) → signed Stripe webhook
events (grant, replay, amount mismatch, unpaid, unknown intent). It never calls Stripe and never
spends Renderful credits; the fake catalogue uses the live USD ranges.

`npm run qa:catalog` needs network (the `/models` endpoint is public; set `RENDERFUL_API_KEY` if
you want the authenticated view). It fails if a documented model id disappears or its live
`cost.min`/`cost.max` drifts from `skill/references/asset-credits.md`.

Covers pricing ranges and fallback, atomic debit/credit/idempotency, quote reserve → settle/refund,
failure and timeout refunds, Stripe signature verification and replay protection, signed URLs,
license caching, rate limiting, and HTTP smoke tests.

## Troubleshooting

| symptom | cause / fix |
|---|---|
| `402 payment_required` | balance below the max reservation. Buy a pack or quote a cheaper model. |
| `401/403` on a key that worked | validator rejected or cached a negative result; check `LICENSE_VALIDATE_URL` and the plan. |
| `503 Could not verify your license` | validator unreachable and no cached grant. Restore the validator or (dev only) `ALLOW_UNVERIFIED_LICENSES=true`. |
| prices look stale | `GET /v1/credits/models?` shows the cached catalog; wait `MODELS_TTL_MS` or delete `DATA_DIR/renderful-models.json`. |
| job stuck in `queued` | Renderful slow or key rejected at create; check logs and `/health`. Jobs fail+refund after their type timeout. |
| output link `403` | expired or tampered. Re-read the job to mint a fresh signed URL. |
| webhook `400 Invalid Stripe signature` | wrong `STRIPE_WEBHOOK_SECRET`, or a proxy rewrote the raw body. |
