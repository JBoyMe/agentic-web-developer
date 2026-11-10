# Licensing — the skill is free; three paid gates

The **agentic-web-developer skill itself is free** — no license key, no subscription, no verification before any department, mode, or stage. Exactly three things are paid, and each is charged only when it's used:

| What | Price | When it's checked |
|---|---|---|
| **The skill** (all 11 departments, modes A–D) | **Free** | Never |
| **Animotion license** — the only animation setup this skill permits | Studio **$15/month** | Before any animation work (Motion handoff, Stage 7.2) |
| **Template plan** — using/saving templates (Mode E) and site maintenance (Mode F) | **$25/month** | Before any `/awd-mode-e*` / `/awd-mode-f*` work |
| **Asset-credit top-ups** — asset generation | packs from **$7** | Before every Asset Builder generation |

**Monthly plan credits are gone.** Plans no longer grant a starter allowance (no 100/215 monthly credits) — every plan includes **zero credits**, and generation is paid **only** with prepaid, non-expiring top-up packs. This guide covers the two subscriptions, buying credits, and wiring credentials up.

## Paying for Animotion (animation — required for every project)

All web animation is implemented by the **AnimotionJS agentic skill**; it is the only animation setup allowed, so every project needs a key:

[![Get Animotion — $15/mo](https://img.shields.io/badge/Get_Animotion-%2415%2Fmonth-222222)](https://skills.animotion.click/checkout?plan=studio)

1. **Click the button** — opens [`skills.animotion.click/checkout?plan=studio`](https://skills.animotion.click/checkout?plan=studio) (Studio plan, $15/month).
2. **Enter your email** — the license key is tied to this address.
3. **Continue to Payment** — Stripe's hosted checkout (card payment).
4. **Confirm the subscription** — $15/month, renews monthly, cancel anytime from the Stripe invoice email.
5. **Copy your license key** — the confirmation page shows it immediately (`sec_live_…`).

Install Animotion with it: `npx animotion-skills install --tier=agentic --agent=<agent> --license-key=YOUR_KEY` (restart the agent afterwards). Full options: the skill's `references/animotion-handoff.md`. **Never substitute another animation library** — if Animotion is unlicensed, the fix is subscribing.

## Paying for the Template plan — $25/month (templates)

**Mode E** (save any project as a template, build new projects from templates) and **Mode F** (maintain an AWD-built site) require the Template plan:

[![Get Template — $25/mo](https://img.shields.io/badge/Get_Template-%2425%2Fmonth-6C2BD9)](https://skills.animotion.click/checkout?plan=template)

- The Mode E/F gate validates with `"plan": "template"` — a Pro/Studio key fails by design and gets this link; admin credentials also pass.
- One Template key covers everything Mode E/F need. **The departments are free** — never stack plans.
- Steps are identical to the Animotion flow above (email → Stripe → copy `sec_live_…`).

## Generation credits (top-ups only)

Generation runs on **credits**, and the **only** source is a one-time top-up pack (monthly plan allowances were removed):

**Top-up packs (one-time, no auto-renew, no expiry):**

| Pack | Credits | Price | Per credit |
|---|---|---|---|
| Starter | 100 | **$7** | $0.070 |
| Top-up | 140 | **$10** | $0.071 |
| Builder | 300 | **$21** | $0.070 |
| Production | 1,000 | **$65** | $0.065 |
| Agency | 3,000 | **$189** | $0.063 |

- **Top-ups never expire.** Buy before you generate; a zero balance blocks generation only (the build continues on user file / keep demo / local Blender / SVG).
- **1 credit = $0.05 of Renderful spend.** The agent quotes a min–max range from the live model catalogue before generating. In managed mode the proxy reserves the max, settles at the actual cost Renderful returns and refunds the difference; failures and timeouts are refunded in full. In local/BYO mode the skill deducts only after a successful download and writes the refund itself.
- **Local headless Blender renders cost 0 credits** — block-animation video and full 3D builds on your own machine. Only the cloud AI passes and cloud meshes spend credits.

### Where the balance lives

| | Managed credits (default when configured) | Local / BYO key |
|---|---|---|
| Turned on by | `AWD_CREDITS_API_URL` set (installer or env) | no proxy URL, `RENDERFUL_API_KEY` present |
| API key holder | the credits proxy — never the skill | your environment |
| Balance / ledger | proxy (`GET /v1/credits/balance` → `balance`; `GET /v1/credits/history`) | `~/.agentic-web-developer/credits.json` (CI override `AWD_CREDIT_BALANCE`) |
| Buy | top-ups via `POST /v1/credits/checkout` → Stripe link; credits land by signed webhook | operator/manual file edit |
| Auth | your **license key** (`x-license-key`) — used for Mode E/F and Animotion too | none |

There is no separate credits storefront: buy from the Asset Builder, which calls `POST /v1/credits/checkout` with the pack id and shows the Stripe link (`AWD_CREDITS_CHECKOUT_URL` sets a static fallback if your operator runs one). Per-model prices: the skill's `references/asset-credits.md`. Proxy contract + deploy: `docs/PRODUCTION.md`.

> **The Asset Builder is the only way to add assets to a project.** Never call another generator/API, and never use a user-supplied generation API key.

## Install the skill files (no key needed)

The npm package ships the installer, slash commands and docs; the skill files install with **no license key** (Node 18+; opencode path shown):

```bash
npx agentic-web-developer install --agent=opencode

# or every detected agent at once:
npx agentic-web-developer install --all
```

`<your-agent>` is one of the 15 supported agents (`opencode`, `claude`, `copilot`, `cursor`, … — full list in [INSTALL.md](INSTALL.md)). The installer copies the skill payload from its configured skill source — nothing to pay for. Restart the agent afterwards so the skill loads.

> **Optional:** `--license-key=YOUR_KEY` saves your key into `animotion-config.json` at install time so the Mode E/F gate (Template plan), the Animotion handoff, and Asset Builder credit auth find it without prompting. It does **not** unlock the skill — the skill is free.

## Add your license key (for the paid gates)

Pick one — the gates look for environment variables first, then the installer's config file, then asks you once.

**1. Install with your key (recommended — one command, everything wired)**

```bash
npx agentic-web-developer install --agent=<your-agent> --license-key=YOUR_KEY

# or install for every detected agent at once:
npx agentic-web-developer install --all --license-key=YOUR_KEY
```

With **admin credentials instead of a license key** (Animotion staff / whitelisted emails only):

```bash
npx agentic-web-developer install --agent=<your-agent> --admin-email=you@example.com --admin-secret=YOUR_ADMIN_SECRET
```

**2. Environment variable**

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
export AGENTIC_LICENSE_KEY="sec_live_xxxxxxxx"
```

```powershell
# PowerShell — persistent for your user (open a new terminal afterwards)
setx AGENTIC_LICENSE_KEY "sec_live_xxxxxxxx"
```

`ANIMOTION_LICENSE_KEY` works as an alias — one variable serves this skill, the Animotion installer, and the credits proxy.

**3. `animotion-config.json` by hand** — same file the installer writes. The gates read it from the agentic-web-developer skill directory, its parent (`~/.config/opencode/skills/` for opencode), `~/.animotion-skills/`, or the path in `AGENTIC_LICENSE_CONFIG`:

```json
{
  "tier": "template",
  "requiredPlan": "template",
  "authMethod": "license",
  "licenseKey": "sec_live_xxxxxxxx"
}
```

**4. Admin credentials via environment** (Animotion staff / whitelisted emails only) — env vars `AGENTIC_ADMIN_EMAIL` + `AGENTIC_ADMIN_SECRET`, or a config file with `"authMethod": "admin"` and `adminEmail` / `adminSecret` fields (installer-written files store the secret encrypted as `adminSecretEncrypted` + `encryptionKey`; the gates decrypt those automatically). Never commit these.

**5. Ask in-session**

With nothing found, a gate asks once (via its question tool) — paste the key, it validates immediately and remembers it via the cache below.

## What happens at runtime

- **Departments: nothing.** No key is needed for any department work — there is no entry gate.
- **Mode E/F (once per session, at most):** the gate calls
  `POST https://skills.animotion.click/api/license/validate`
  with `{ "licenseKey": "…", "skill": "agentic-web-developer", "plan": "template" }` (or the admin-credential variant).
- On success the verdict is cached at `~/.animotion-skills/cache/agentic-web-developer-verdict.json` for **7 days** — later sessions in that window skip the network call.
- The server answers `valid: true` for Template keys and whitelisted admins; `valid: false` carries a `reason` (invalid key, wrong plan, not whitelisted).
- **Motion handoff:** the Animotion skill validates its own key when invoked — a 401 means subscribe, never substitute.
- **Credits:** every generation authenticates with the same key (`x-license-key`) against the credits proxy; balance comes from top-ups only.

Point the gate at a local dev server with `AGENTIC_LICENSE_SERVER=http://localhost:5000` (defaults to `https://skills.animotion.click`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| A department asks for a license key | Wrong — the skill is free. There is no entry gate; only Mode E/F, the Animotion handoff, and credit purchases need keys. |
| Mode E/F rejected: plan below "template" | Expected — Mode E/F need the **Template plan** ($25/month): [upgrade at checkout](https://skills.animotion.click/checkout?plan=template). The departments themselves stay free. |
| `valid: false`, reason "Invalid license format" / "Invalid signature" | Wrong or truncated key — copy it again from the checkout confirmation page. |
| Animotion install or `/animate` returns 401 | The Animotion skill has no valid key — [subscribe](https://skills.animotion.click/checkout?plan=studio) ($15/month) and pass `--license-key=YOUR_KEY`. |
| Asset generation says insufficient credits | Buy a top-up pack from the Asset Builder — there are no monthly plan credits anymore. |
| `valid: false`, reason "Email not whitelisted" | Admin path but the email isn't on the server whitelist — use a personal key instead. |
| `valid: false`, reason "Invalid admin secret" | `AGENTIC_ADMIN_SECRET` doesn't match the server's `ADMIN_SECRET`. |
| Gate keeps asking for the key | Verdict cache expired or unwritable — fix credentials, then run one validation; check `~/.animotion-skills/cache/` is writable. |
| "server unreachable, no cached verdict" | No network on first use — connect once; after that the 7-day cache covers offline Mode E/F work. |
| Changed or cancelled the subscription | Delete `~/.animotion-skills/cache/agentic-web-developer-verdict.json` to force a re-check immediately. |
| Download of the skill files returns 401/403 | The skill is free — use `npx agentic-web-developer install` (no key) instead of the license-server download URL. |
