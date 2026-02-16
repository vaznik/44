# Free deploy guide (Render + Supabase + Upstash + Cloudflare Pages)

This guide deploys **Pot Roulette** with **free tiers**.

Architecture:
- **Supabase**: Postgres (DB)
- **Upstash**: Redis (locks + BullMQ jobs)
- **Render**: 2 services (backend + bot)
- **Cloudflare Pages**: webapp (static export)

---

## 0) Create Telegram bot + Mini App
1. Create bot via **@BotFather** and copy:
   - `TELEGRAM_BOT_TOKEN`
   - bot username (`NEXT_PUBLIC_BOT_USERNAME`)

2. Create a **Telegram Mini App** (BotFather → Bot Settings → Mini App) and set:
   - Web App URL (you will paste Cloudflare Pages URL later)
   - Short name (set `NEXT_PUBLIC_WEBAPP_SHORTNAME`)

3. Enable **Telegram Stars** payments:
   - Configure payments in BotFather and get `TELEGRAM_STARS_PROVIDER_TOKEN`

---

## 1) Create DB (Supabase)
1. Create a Supabase project (free).
2. Get your Postgres connection string:
   - Set it as `DATABASE_URL` in Render (backend service)
3. IMPORTANT: use a fresh DB (this version has a new schema).

---

## 2) Create Redis (Upstash)
1. Create Upstash Redis (free)
2. Copy Redis URL:
   - Set as `REDIS_URL`
3. If the URL is `rediss://...` (TLS), set:
   - `REDIS_TLS=1`

---

## 3) Deploy Backend on Render (free Web Service)
1. Create a new **Web Service** on Render from your GitHub repo.
2. Root directory: repo root
3. Build command:
```bash
corepack enable
pnpm i --frozen-lockfile
pnpm --filter backend db:generate
pnpm --filter backend db:migrate
pnpm --filter backend build
```

4. Start command:
```bash
pnpm --filter backend start
```

5. Add environment variables (Render → Environment):
- `NODE_ENV=production`
- `BACKEND_PUBLIC_URL=https://YOUR_BACKEND.onrender.com`
- `CORS_ORIGINS=https://YOUR_CLOUDFLARE_PAGES_DOMAIN`
- `DATABASE_URL=...`
- `REDIS_URL=...`
- `REDIS_TLS=1` (if needed)
- `BULL_PREFIX=tgroulette`

- `TELEGRAM_BOT_TOKEN_FOR_INITDATA=YOUR_BOT_TOKEN`

- `HOUSE_TG_USER_ID=YOUR_TELEGRAM_NUMERIC_ID`
- `HOUSE_FEE_BPS=100`

- `GLOBAL_ROOM_CURRENCY=XTR`
- `GLOBAL_ROUND_DURATION_SECONDS=30`

- `DEVICE_FINGERPRINT_SALT=...long random...`

- TON (optional):
  - `TON_RECEIVER_ADDRESS=...`
  - `TONAPI_KEY=...` / `TONCENTER_API_KEY=...`

6. Open the backend URL and check:
- `/health`
- `/bootstrap`

---

## 4) Deploy Bot on Render (free Web Service)
1. Create another Render **Web Service** from the same repo.
2. Build command:
```bash
corepack enable
pnpm i --frozen-lockfile
pnpm --filter bot build
```

3. Start command:
```bash
pnpm --filter bot start
```

4. Env vars for bot:
- `NODE_ENV=production`
- `BOT_PORT=8081`
- `TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN`
- `TELEGRAM_STARS_PROVIDER_TOKEN=YOUR_PROVIDER_TOKEN`

- `BACKEND_URL=https://YOUR_BACKEND.onrender.com`
- `WEBAPP_SHORTNAME=YOUR_WEBAPP_SHORTNAME`
- `PUBLIC_WEBAPP_URL=https://YOUR_CLOUDFLARE_PAGES_DOMAIN`

- `TELEGRAM_WEBHOOK_URL=https://YOUR_BOT.onrender.com`
- `TELEGRAM_WEBHOOK_PATH=/tg/webhook`

- `WEBHOOK_SECRET=...` (internal secret for bot->backend)
- `WEBHOOK_SECRET=...same secret...` (backend verifies it)

> The bot sets Telegram webhook automatically on startup when `TELEGRAM_WEBHOOK_URL` is set.

---

## 5) Deploy WebApp on Cloudflare Pages (free)
1. Create a new Cloudflare Pages project from your GitHub repo.
2. Build settings:
- Framework: Next.js
- Build command:
```bash
corepack enable
pnpm i --frozen-lockfile
pnpm --filter webapp build
```
- Output directory:
  - `packages/webapp/out`

3. Set Pages env vars:
- `NEXT_PUBLIC_BACKEND_URL=https://YOUR_BACKEND.onrender.com`
- `NEXT_PUBLIC_BOT_USERNAME=YOUR_BOT_USERNAME`
- `NEXT_PUBLIC_WEBAPP_SHORTNAME=YOUR_WEBAPP_SHORTNAME`
- `NEXT_PUBLIC_TONCONNECT_MANIFEST_URL=https://YOUR_CLOUDFLARE_PAGES_DOMAIN/tonconnect-manifest.json`
- `NEXT_PUBLIC_TON_RECEIVER_ADDRESS=...` (optional)

4. Update `packages/webapp/public/tonconnect-manifest.json` for production:
- `url` = your Pages domain
- `iconUrl` = your Pages domain + `/icon.svg`

---

## 6) Final checklist
- Open your bot chat: `/start`
- Press **Open Roulette**
- Deposit Stars: `/deposit 100`
- In the Mini App: open global room → place bet → wait for round end

---

## Troubleshooting
- If /bootstrap fails: check `DATABASE_URL` and migrations
- If bets fail with `INSUFFICIENT_FUNDS`: deposit first
- If Stars payments do not credit:
  - make sure bot webhook is set (bot logs should show webhook URL)
  - check `WEBHOOK_SECRET` matches in bot and backend
- If TON confirm says `ton_not_found_yet`: wait 5-30 seconds and retry confirm
