'use client';

export function getTelegram() {
  const w = window as any;
  return w.Telegram?.WebApp;
}

export function initTelegram() {
  const tg = getTelegram();
  if (!tg) return null;
  tg.ready();
  tg.expand();
  return tg;
}

export function initDataUnsafe() {
  const tg = getTelegram();
  return tg?.initData || '';
}

export function userFromInitDataUnsafe() {
  const tg = getTelegram();
  return tg?.initDataUnsafe?.user || null;
}
