import { prisma } from '../prisma';
import { addEntry, toNano } from './ledger';
import { idempotencyGuard } from './idempotency';
import { PaymentProvider, Currency } from '@prisma/client';

/**
 * Stars successful_payment comes via bot update.
 * Bot calls backend endpoint /payments/stars/success with:
 * - tgUserId
 * - telegramPaymentChargeId
 * - totalAmountStars (int)
 * - payload (string)
 *
 * Idempotency:
 * - idempotency key = `stars:${telegramPaymentChargeId}`
 */
export async function confirmStarsPayment(params: {
  userId: string;
  telegramPaymentChargeId: string;
  totalAmountStars: number;
  currency: Currency; // XTR
}) {
  const idemKey = `stars:${params.telegramPaymentChargeId}`;
  const first = await idempotencyGuard(idemKey);
  if (!first) return { ok: true, already: true };

  // Create payment intent record for audit
  const amountNano = toNano(params.currency, String(params.totalAmountStars));
  await prisma.paymentIntent.create({
    data: {
      userId: params.userId,
      provider: 'STARS',
      currency: params.currency,
      amountNano,
      status: 'CONFIRMED',
      idempotencyKey: idemKey,
      providerRef: params.telegramPaymentChargeId,
      confirmedAt: new Date(),
    },
  });

  // Ledger deposit
  await addEntry({
    userId: params.userId,
    currency: params.currency,
    type: 'DEPOSIT',
    amountNano,
    refType: 'STARS',
    refId: params.telegramPaymentChargeId,
  });

  return { ok: true, already: false };
}
