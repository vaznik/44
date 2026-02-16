'use client';

import { initDataUnsafe } from './tg';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'tg_device_id_v1';
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = (window.crypto as any)?.randomUUID?.() ?? String(Date.now()) + '_' + Math.random().toString(16).slice(2);
    window.localStorage.setItem(key, id);
  }
  return id;
}

async function getInitData(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const real = initDataUnsafe();
  if (real && real.length > 10) return real;

  const key = 'tg_dev_initdata_v1';
  const cached = window.localStorage.getItem(key);
  if (cached && cached.length > 10) return cached;

  // Dev convenience: if you're running locally outside Telegram,
  // backend exposes /dev/initData ONLY in NODE_ENV=development.
  try {
    const r = await fetch(`${BACKEND}/dev/initData`);
    const j = await r.json();
    if (r.ok && j?.ok && j?.initData) {
      window.localStorage.setItem(key, j.initData);
      return String(j.initData);
    }
  } catch {
    // ignore
  }

  return '';
}

async function headersBase() {
  const initData = await getInitData();
  const deviceId = getDeviceId();
  return {
    'x-telegram-init-data': initData,
    'x-device-id': deviceId,
  } as Record<string, string>;
}

export async function apiGet(path: string) {
  const r = await fetch(`${BACKEND}${path}`, {
    headers: await headersBase(),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'request_failed');
  return j;
}

export async function apiPost(path: string, body: any) {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await headersBase()) },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'request_failed');
  return j;
}
