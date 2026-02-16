# Local run (Windows)

## Requirements
- Node.js 20+ (LTS recommended)
- pnpm
- Docker Desktop (for Postgres + Redis)

## 1) Prepare env
1. Copy env:
   - `copy .env.example .env`

2. Open `.env` and set:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_STARS_PROVIDER_TOKEN`
   - `TELEGRAM_BOT_TOKEN_FOR_INITDATA` (same as bot token)
   - `HOUSE_TG_USER_ID` (your numeric Telegram id)
   - `DEVICE_FINGERPRINT_SALT` (random long string)
   - `TON_RECEIVER_ADDRESS` (if you want TON deposits)

> For local browser testing (without Telegram), backend exposes `/dev/initData` in non-production mode.

## 2) Start Postgres + Redis
From the repo root:
```powershell
docker compose up -d
```

## 3) Install deps
```powershell
pnpm i
```

## 4) DB migrate
```powershell
pnpm --filter backend db:generate
pnpm --filter backend db:migrate:dev
```

## 5) Start all services
```powershell
pnpm dev
```

- Webapp: http://localhost:3000
- Backend: http://localhost:8080

## Notes about Telegram Stars on local
Telegram needs a **public HTTPS webhook URL**.
For local testing, use ngrok/cloudflared and set:
- `TELEGRAM_WEBHOOK_PATH=/tg/webhook`
- `PUBLIC_WEBAPP_URL` and `PUBLIC_APP_URL` to your public domain
- Configure webhook:
```powershell
pnpm --filter bot set:webhook
```
