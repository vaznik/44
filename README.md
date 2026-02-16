# Telegram Mini App – Pot Roulette (Monorepo)

Monorepo: **backend (Fastify)** + **bot (Telegraf)** + **webapp (Next.js export)** + **shared** (types/validation/fairness)

## What it does

**Pot Roulette (a.k.a. Jackpot Wheel):**
- Users place bets into a **pot**.
- The wheel has **N segments** where **N = number of unique users** in the current round.
- Segment size is **proportional to the user’s total bet** in the round.
- When the round ends, the wheel “spins” and **one winner takes the pot** minus the **house fee**.
- **House fee = 1%** of the total pot (configurable via `HOUSE_FEE_BPS`), credited to the **admin/house Telegram account**.

## Payments supported
- **Telegram Stars (XTR)**: deposit via the bot invoice flow (pre-checkout → successful_payment).
- **TON**: deposit via TonConnect on frontend + backend verifies the tx (TonAPI / toncenter).

## Security & reliability (built-in)
- Strict Telegram WebApp **initData verification**
- **Ledger-only** accounting model (no “balance” column)
- **Idempotency** for payment webhooks
- **Redis locks** for bet placement / round settlement
- **Provably fair** commit–reveal (serverSeedHash → reveal serverSeed + clientSeedAgg + digest)
- Rate limiting

## Quick start
See:
- `docs/windows-local.md`
- `docs/deploy.md`

## Workspaces
- `packages/shared`
- `packages/backend`
- `packages/bot`
- `packages/webapp`
