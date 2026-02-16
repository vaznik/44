import { z } from 'zod';
import { Currency } from './types';

export const CurrencySchema = z.enum(['XTR', 'TON']) satisfies z.ZodType<Currency>;

export const DecimalAmountSchema = z.string().regex(/^[0-9]+(\.[0-9]+)?$/);

export const CreateRoomSchema = z.object({
  currency: CurrencySchema,
  title: z.string().min(2).max(32).optional(),

  maxPlayers: z.number().int().min(2).max(100).optional(), // undefined => unlimited

  minBet: DecimalAmountSchema.optional(), // default 0
  maxBet: DecimalAmountSchema.optional(), // undefined => unlimited
  maxTotalPot: DecimalAmountSchema.optional(), // undefined => unlimited

  roundDurationSeconds: z.number().int().min(10).max(3600).optional(), // default 30
  startMode: z.enum(['TIMER', 'FILL']).optional(), // default TIMER
});

export const PlaceBetSchema = z.object({
  roomId: z.string().min(2),
  amount: DecimalAmountSchema,
  clientSeed: z.string().min(6).max(64),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const SetSettingsSchema = z.object({
  language: z.enum(['en', 'ru']).optional(),
  notifications: z.boolean().optional(),
});
