# DMO Bot ↔ R&A HQ database — setup guide

The Discord bot (`dmo-bot`) now reads and writes the HQ database directly through the website, instead of going through the Google Sheet. The sheet stays as a backup only.

```
Discord ──► dmo-bot (Worker)  ──POST /api/bot──►  HQ site (Pages) ──► D1 database "hq"
                  ▲                ──GET /api/public─►        │
                  └──────────── /sync, /proof, /img ──────────┘
```

## What lives where

**Site repo** (the Pages project) — the site files at the top level, plus:

| File | What it is |
|---|---|
| `_worker.js/hq.js` | pentagon_'s HQ build, **unchanged** (this used to be the single `_worker.js` file) |
| `_worker.js/bot.js` | The bot's API: `POST /api/bot` |
| `_worker.js/index.js` | Entry point: `/api/bot` → `bot.js`, everything else → `hq.js`; sends the HQ's calls to the bot's new address |

**Bot repo** (e.g. `DMO-Bot`, the Worker)

| File | What it is |
|---|---|
| `worker.js` | The Discord bot |
| `wrangler.toml` | Its name, KV binding, cron and the two site links |

> Keep the bot out of the site repo: everything in the site repo is published as part of the website.

Secrets are **never** put in either repo. They live only in Cloudflare.

---

## Setup (new Cloudflare account, database already running)

### 1. Site repo
1. Delete the file `_worker.js`.
2. Upload the folder `_worker.js/` with `index.js`, `bot.js`, `hq.js` (**Add file → Upload files**, drag the folder in, **Commit**).
3. Cloudflare redeploys the site automatically. Check **Deployments** shows *Success*.

### 2. KV for the bot
**Storage & databases → KV → Create** → name `BOT_KV`. Copy its **ID** (not a secret).

### 3. Bot repo
1. Create a private repo (e.g. `DMO-Bot`) with `worker.js` and `wrangler.toml`.
2. Edit `wrangler.toml`:
   - `id` → already set to the KV ID from step 2
   - `SHEETS_URL` / `HQ_URL` → already set to `https://rna-hq.pages.dev/...` (change if the site moves)
3. **Workers & Pages → Create → Import a repository** → pick the bot repo.
   - Project name: `dmo-bot` (must match `name` in `wrangler.toml`)
   - Build command: empty · Deploy command: `npx wrangler deploy`
4. **dmo-bot → Settings → Variables and secrets** → add, as type **Secret**:

   | Name | Value |
   |---|---|
   | `BOT_TOKEN` | Discord bot token (Developer Portal → Bot → Reset Token) |
   | `SHEETS_SECRET` | The shared secret — see step 5 |
   | `REGISTER_KEY` | Any random key (used to register slash commands) |

5. Note the bot's address: `https://dmo-bot.flat-mountain-580e.workers.dev`.

### 4. Point the site at the bot
On the **Pages project → Settings**:
1. **Variables and secrets → Add** → Text `BOT_URL` = the bot's address from 3.5.
2. **Bindings → Add → Service binding** → name `BOT`, service `dmo-bot`.
3. **Deployments → ⋯ → Retry deployment** (settings only apply to a new deployment).

### 5. The shared secret
The bot's `SHEETS_SECRET` must equal `prop:APPROVAL_SECRET` in the database (the site signs its messages to the bot with it, and the bot uses it on `/api/bot`).

- **Know the old value?** Use it as `SHEETS_SECRET`. Done.
- **Don't know it / want a new one:**
  1. Make a key: in the roster's Apps Script add `MigrateHQ.gs` and run `hqMakeKey` (copy it from the log).
  2. Set it as the bot's `SHEETS_SECRET`.
  3. In **D1 → hq → Console**, run (key inside both sets of quotes):
     ```sql
     UPDATE settings SET value = '"PASTE_KEY"' WHERE key = 'prop:APPROVAL_SECRET';
     ```

Never paste the key in chat or commit it.

### 6. Discord
**Discord Developer Portal → your app → General Information → Interactions Endpoint URL** → the bot's new address (same path as before). Discord tests it when you save; it must say saved.

### 7. Check it works
1. Visit `https://<site>/api/public?api=events` — JSON, not an error.
2. In Discord: `/lookup` someone → their profile shows.
3. Log a test event → it appears on the site's **Approvals** page.
4. **Claim** → **Approve** in Discord → shows *Approved*, then *Done* within a few minutes (the site's approvals job adds the points).
5. Approve/deny something on the website → the Discord message updates.

---

## Day to day

- **Change the bot:** edit `worker.js` in the bot repo → push → Cloudflare redeploys. Don't edit it in Cloudflare's online editor (the next push overwrites it).
- **New HQ build from pentagon_:** replace `_worker.js/hq.js` in the site repo with his `_worker.js` renamed to `hq.js`. Leave `index.js` and `bot.js` alone.
- **Rollback:** Pages/Worker → **Deployments** → pick an older one → **Rollback**.
- **Rotate a secret:** change it in Cloudflare (and for the shared secret, in the database too — step 5).

## Good to know

- **Discord approvals** are marked *Approved* straight away and carried out by the site's own approvals job within ~1–3 minutes, then the bot gets *Done* / *Error*.
- **Claims** last 30 minutes. Only the claimer can approve or deny. DMO decides events/awards/roster requests; CPM decides LOAs.
- **Sheet backup:** once the bot has used `/api/bot`, the sheet's sync no longer overwrites Discord links, and events scheduled from Discord survive the sheet's HQ Events copy.
- **Old bot address:** `hq.js` still names the old account's bot (`APPROVAL_WORKER_URL`). `index.js` redirects those calls to `BOT_URL`, so nothing breaks; pentagon_ can update it in his source whenever.
- **`compatibility_date`** in `wrangler.toml` is `2025-06-01`; change it if the bot needs a newer one.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Bot says "Not allowed" | `SHEETS_SECRET` ≠ `prop:APPROVAL_SECRET` (step 5) |
| "the roster link replied with something unexpected" | `SHEETS_URL` in `wrangler.toml` isn't `https://<site>/api/bot` |
| "the HQ link didn't send back JSON" | `HQ_URL` isn't `https://<site>/api/public` |
| Website approvals don't update Discord | `BOT_URL` / `BOT` binding missing on Pages, or not redeployed after adding them |
| Approved in Discord but never *Done* | Approvals paused or roster frozen in site Settings; check the site's Approvals page for *Error* |
| Discord won't save the endpoint URL | Bot not deployed yet, or `BOT_TOKEN`/public key mismatch — check the Worker's logs |
| Bot deploy removes the KV / cron | They must be in `wrangler.toml` (the dashboard copy is replaced on each deploy) |
