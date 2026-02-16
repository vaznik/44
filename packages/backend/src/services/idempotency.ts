import { redis } from '../redis';
import { env } from '../env';

export async function idempotencyGuard(key: string): Promise<boolean> {
  // Returns true if first time seen.
  const ok = await redis.set(`idem:${key}`, '1', 'NX', 'EX', env.idempotencyTtlSeconds);
  return Boolean(ok);
}
