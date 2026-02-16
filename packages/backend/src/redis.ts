import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.redisUrl, {
  tls: env.redisTls ? {} : undefined,
  maxRetriesPerRequest: null,
});

export async function withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const lockKey = `lock:${key}`;
  const token = Math.random().toString(16).slice(2);
  const ok = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
  if (!ok) throw new Error('LOCK_BUSY');

  try {
    return await fn();
  } finally {
    const val = await redis.get(lockKey);
    if (val === token) await redis.del(lockKey);
  }
}
