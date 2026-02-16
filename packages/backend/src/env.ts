import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',

  backendPort: Number(process.env.BACKEND_PORT ?? '8080'),
  backendHost: process.env.BACKEND_HOST ?? '0.0.0.0',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:8080',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),

  // Telegram WebApp initData verification (strict)
  telegramBotTokenForInitData: req('TELEGRAM_BOT_TOKEN_FOR_INITDATA'),

  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? '120'),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_TIME_WINDOW_MS ?? '60000'),

  databaseUrl: req('DATABASE_URL'),

  redisUrl: req('REDIS_URL'),
  redisTls: (process.env.REDIS_TLS ?? '0') === '1',
  bullPrefix: process.env.BULL_PREFIX ?? 'tgroulette',

  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? '86400'),

  // House/admin fee recipient
  houseTgUserId: BigInt(req('HOUSE_TG_USER_ID')),
  houseFeeBps: Number(process.env.HOUSE_FEE_BPS ?? '100'), // 100 = 1%

  // Global room defaults
  globalCurrency: (process.env.GLOBAL_ROOM_CURRENCY ?? 'XTR') as 'XTR' | 'TON',
  globalRoundDurationSeconds: Number(process.env.GLOBAL_ROUND_DURATION_SECONDS ?? '30'),

  // TON
  tonNetwork: process.env.TON_NETWORK ?? 'mainnet',
  tonReceiverAddress: req('TON_RECEIVER_ADDRESS'),
  tonapiKey: process.env.TONAPI_KEY ?? '',
  toncenterKey: process.env.TONCENTER_API_KEY ?? '',
  tonapiBaseUrl: process.env.TONAPI_BASE_URL ?? 'https://tonapi.io',
  toncenterBaseUrl: process.env.TONCENTER_BASE_URL ?? 'https://toncenter.com/api/v2',

  // Device fingerprint (soft anti-abuse)
  deviceFingerprintSalt: req('DEVICE_FINGERPRINT_SALT'),
};
