/**
 * Telegram WebApp initData verification (HMAC-SHA256) per docs:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Steps:
 * - parse initData into key/value pairs
 * - create data_check_string with sorted keys excluding 'hash'
 * - secret_key = HMAC_SHA256('WebAppData', bot_token)
 * - calculated_hash = HMAC_SHA256(secret_key, data_check_string) hex
 */
import crypto from 'crypto';
import { Buffer } from "node:buffer";


export function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

export function buildDataCheckString(data: Record<string, string>) {
  const keys = Object.keys(data).filter((k) => k !== 'hash').sort();
  return keys.map((k) => `${k}=${data[k]}`).join('\n');
}

export function hmacSha256(key: Buffer | string, msg: string) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest();
}

export function verifyInitData(initData: string, botToken: string): { ok: true; data: Record<string, string> } | { ok: false; reason: string } {
  try {
    const data = parseInitData(initData);
    const hash = data['hash'];
    if (!hash) return { ok: false, reason: 'missing_hash' };

    const dataCheckString = buildDataCheckString(data);
    const secretKey = hmacSha256('WebAppData', botToken);
    const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString, 'utf8').digest('hex');

    if (calculated !== hash) return { ok: false, reason: 'hash_mismatch' };

    // Optional freshness check (auth_date)
    const authDate = Number(data['auth_date'] || '0');
    if (!authDate) return { ok: false, reason: 'missing_auth_date' };
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - authDate) > 24 * 3600) return { ok: false, reason: 'auth_date_too_old' };

    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, reason: 'exception:' + (e?.message ?? String(e)) };
  }
}


export function signInitData(data: Record<string, string>, botToken: string): string {
  // Create initData-like query string with a valid hash (DEV/testing only).
  // This is useful for local development outside Telegram.
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) params.set(k, v);

  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;

  const dataCheckString = buildDataCheckString(obj);
  const secretKey = hmacSha256('WebAppData', botToken);
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString, 'utf8').digest('hex');

  params.set('hash', hash);
  return params.toString();
}
