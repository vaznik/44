import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  botToken: req('TELEGRAM_BOT_TOKEN'),
  providerToken: req('TELEGRAM_STARS_PROVIDER_TOKEN'),
  webhookSecret: req('WEBHOOK_SECRET'),
  webhookPath: process.env.TELEGRAM_WEBHOOK_PATH ?? '/tg/webhook',
  backendPublicUrl: req('BACKEND_PUBLIC_URL'),
  publicWebappUrl: req('PUBLIC_WEBAPP_URL'),
  adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? '0',
};
