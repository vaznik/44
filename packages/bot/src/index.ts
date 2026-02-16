import { Telegraf } from 'telegraf';
import { env } from './env';

const bot = new Telegraf(env.botToken);

bot.start(async (ctx) => {
  await ctx.reply(
    `🎡 Welcome! Open the Mini App:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Open Roulette', web_app: { url: env.publicWebappUrl } }]],
      },
    },
  );
});

bot.command('deposit', async (ctx) => {
  // Deposit via Stars invoice
  // Usage: /deposit 100
  const parts = ctx.message.text.split(' ');
  const amount = Number(parts[1] ?? '100');
  const stars = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 100;

  await ctx.replyWithInvoice({
    title: 'Deposit Stars',
    description: 'Top up your balance with Telegram Stars',
    payload: `deposit:${ctx.from.id}:${Date.now()}`,
    provider_token: env.providerToken,
    currency: 'XTR',
    prices: [{ label: 'Stars', amount: stars }],
  });
});

bot.on('pre_checkout_query', async (ctx) => {
  // Always answer within 10 seconds
  await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx) => {
  const sp = (ctx.message as any).successful_payment;
  // Telegram sends:
  // total_amount (integer), currency, telegram_payment_charge_id, provider_payment_charge_id
  const telegramChargeId = sp.telegram_payment_charge_id;
  const totalAmount = sp.total_amount;

  // Notify backend to credit ledger (idempotent)
  const r = await fetch(`${env.backendPublicUrl}/payments/stars/success`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': env.webhookSecret,
    },
    body: JSON.stringify({
      tgUserId: String(ctx.from.id),
      telegramPaymentChargeId: telegramChargeId,
      totalAmountStars: totalAmount,
    }),
  });

  const json = await r.json().catch(() => ({} as any));
  if (!r.ok || !json.ok) {
    await ctx.reply('✅ Payment received, but backend credit failed. Contact support.');
    if (env.adminChatId !== '0') {
      await ctx.telegram.sendMessage(env.adminChatId, `Stars credit failed: ${JSON.stringify({ r: r.status, json })}`);
    }
    return;
  }

  await ctx.reply('✅ Deposit credited! Open the Mini App to play.', {
    reply_markup: { inline_keyboard: [[{ text: 'Open Roulette', web_app: { url: env.publicWebappUrl } }]] },
  });
});

// Webhook handler (for Render)
import http from 'http';

const port = Number(process.env.PORT ?? 8081);

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === env.webhookPath) {
    // Telegram will send this header if you setWebhook with secret_token
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (env.webhookSecret && secret !== env.webhookSecret) {
      res.statusCode = 401;
      res.end('unauthorized');
      return;
    }

    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        await bot.handleUpdate(update, res);
      } catch (e) {
        res.statusCode = 200;
        res.end('ok');
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {

    res.statusCode = 200;
    res.end('ok');
  } else {
    res.statusCode = 404;
    res.end('not found');
  }
});

server.listen(port, async () => {
  console.log(`Bot server listening on :${port}`);

  if (env.telegramWebhookUrl) {
    const url = env.telegramWebhookUrl.replace(/\/$/, '') + env.webhookPath;
    try {
      await bot.telegram.setWebhook(url);
      console.log('Webhook set to:', url);
    } catch (e) {
      console.error('Failed to set webhook:', e);
    }
  } else {
    console.log('TELEGRAM_WEBHOOK_URL is empty; webhook is not set automatically.');
  }
});
