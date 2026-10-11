# Licensing — paying for Pro and unlocking the skill

The agentic-web-developer skill is licensed: it needs an active **Pro plan ($7/month)** Animotion key, or Animotion **admin credentials**, verified **once per session** (cached 7 days) before any pipeline work. This guide covers paying for Pro, installing the skill files with a key or admin credentials, and wiring the credentials up.

## How to pay for Pro

[![Get Pro — $7/mo](https://img.shields.io/badge/Get_Pro-%247%2Fmonth-38ED26)](https://skills.animotion.click/checkout?plan=pro) [![Get Studio — $15/mo](https://img.shields.io/badge/Get_Studio-%2415%2Fmonth-222222)](https://skills.animotion.click/checkout?plan=studio)

1. **Click a Get Pro button** — opens [`skills.animotion.click/checkout?plan=pro`](https://skills.animotion.click/checkout?plan=pro) with the **Pro** plan preselected ($7/month). Studio ($15/month) also unlocks this skill *and* the AnimotionJS agentic animation skill the pipeline hands off to at Stage 8 — usually the better deal if you'll ship sites.
2. **Enter your email** — the license key is tied to this address.
3. **Continue to Payment** — you are redirected to Stripe's hosted checkout (card payment; Stripe handles everything).
4. **Confirm the subscription** — $7/month, renews monthly, cancel anytime from the Stripe invoice email.
5. **Copy your license key** — the confirmation page shows it immediately (`sec_live_…`).

> **Admin credentials are not self-serve.** `--admin-email`/`--admin-secret` and `AGENTIC_ADMIN_*` are a staff bypass for whitelisted emails — everyone else pays with a Pro key from the flow above.

## Install the skill files (license key or admin credentials)

The npm package ships only the installer — the skill files can also be downloaded directly from the license server with your key or admin pair (Node 18+; opencode path shown):

```bash
# bash / zsh — with a Pro license key
KEY="sec_live_xxxxxxxx" \
DEST="$HOME/.config/opencode/skills/agentic-web-developer" \
node -e '
  const fs = require("fs"), path = require("path");
  (async () => {
    const url = "https://skills.animotion.click/api/skills?skill=agentic-web-developer&licenseKey=" + process.env.KEY;
    const j = await (await fetch(url)).json();
    if (!j.success) throw new Error("Download failed - check the key");
    for (const f of j.skills) {
      const p = path.join(process.env.DEST, f.name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f.content);
    }
    console.log("Installed " + j.count + " files -> " + process.env.DEST);
  })();
'
```

```powershell
# PowerShell — with a Pro license key
$env:KEY = "sec_live_xxxxxxxx"
$env:DEST = "$env:USERPROFILE\.config\opencode\skills\agentic-web-developer"
node -e 'const fs=require("fs"),path=require("path");(async()=>{const j=await (await fetch("https://skills.animotion.click/api/skills?skill=agentic-web-developer&licenseKey="+process.env.KEY)).json();if(!j.success)throw new Error("Download failed - check the key");for(const f of j.skills){const p=path.join(process.env.DEST,f.name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,f.content);}console.log("Installed "+j.count+" files -> "+process.env.DEST);})()'
```

**With admin credentials instead of a key** (whitelisted emails only) — same scripts, swap the URL query string for:

```
.../api/skills?skill=agentic-web-developer&adminEmail=you@example.com&adminSecret=YOUR_ADMIN_SECRET
```

Other agents: change `DEST` (e.g. `~/.config/claude/skills/…` for Claude Code, `~/.config/github-copilot/skills/…` for Copilot — full per-agent paths in [INSTALL.md](INSTALL.md)). Restart the agent afterwards so the skill loads. The [`npx agentic-web-developer install`](INSTALL.md) CLI works the same way once a key/admin pair is available.

## Add your license key or admin credentials

Pick one — the skill's gate checks them in this order.

**1. Environment variable (recommended)**

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
export AGENTIC_LICENSE_KEY="sec_live_xxxxxxxx"
```

```powershell
# PowerShell — persistent for your user (open a new terminal afterwards)
setx AGENTIC_LICENSE_KEY "sec_live_xxxxxxxx"
```

`ANIMOTION_LICENSE_KEY` works as an alias — one variable can serve this skill and the Animotion installer.

**2. `animotion-config.json` (shared with the Animotion skill installer)**

If you installed the AnimotionJS skill with `--license-key=…`, the key is already on disk: the installer writes `animotion-config.json` next to the installed skill, and the gate reads it from the agentic-web-developer skill directory, its parent (`~/.config/opencode/skills/` for opencode), `~/.animotion-skills/`, or the path in `AGENTIC_LICENSE_CONFIG`. To create one yourself:

```json
{
  "tier": "pro",
  "requiredPlan": "pro",
  "authMethod": "license",
  "licenseKey": "sec_live_xxxxxxxx"
}
```

**3. Admin credentials (Animotion staff / whitelisted emails only)**

Same pair the license backend uses — provide via env vars `AGENTIC_ADMIN_EMAIL` + `AGENTIC_ADMIN_SECRET`, or a config file with `"authMethod": "admin"` and `adminEmail` / `adminSecret` fields (installer-written files store the secret encrypted as `adminSecretEncrypted` + `encryptionKey`; the gate decrypts those automatically). Never commit these — prefer a personal Pro key for day-to-day work.

**4. Ask in-session**

With nothing found, the skill asks once (via its question tool) — paste the key, it validates immediately and remembers it via the cache below.

## What happens at runtime

- Once per session (at most), the skill calls:
  `POST https://skills.animotion.click/api/license/validate`
  with `{ "licenseKey": "…", "skill": "agentic-web-developer", "plan": "pro" }` (or the admin-credential variant).
- On success the verdict is cached at `~/.animotion-skills/cache/agentic-web-developer-verdict.json` for **7 days** — later sessions in that window skip the network call.
- The server answers `valid: true` for Pro and Studio keys and for whitelisted admins; `valid: false` carries a `reason` (invalid key, wrong plan, not whitelisted).
- If the server is unreachable, a fresh cache (≤7 days) still lets you work; without one, the skill stops until it can verify once.

Point the gate at a local dev server with `AGENTIC_LICENSE_SERVER=http://localhost:5000` (defaults to `https://skills.animotion.click`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `valid: false`, reason "Invalid license format" / "Invalid signature" | Wrong or truncated key — copy it again from the checkout confirmation page. |
| `valid: false`, reason mentions the plan | Your key's plan is below Pro — [upgrade at checkout](https://skills.animotion.click/checkout?plan=pro). |
| `valid: false`, reason "Email not whitelisted" | Admin path but the email isn't on the server whitelist — use a Pro key instead. |
| `valid: false`, reason "Invalid admin secret" | `AGENTIC_ADMIN_SECRET` doesn't match the server's `ADMIN_SECRET`. |
| Skill keeps asking for the key | Verdict cache expired or unwritable — fix credentials, then run one validation; check `~/.animotion-skills/cache/` is writable. |
| "server unreachable, no cached verdict" | No network on first use — connect once; after that the 7-day cache covers offline work. |
| Changed or cancelled the subscription | Delete `~/.animotion-skills/cache/agentic-web-developer-verdict.json` to force a re-check immediately. |
| Download of the skill files returns 401/403 | The install commands above need a valid key/admin pair on the query string — re-check step 5 of "How to pay for Pro". |
