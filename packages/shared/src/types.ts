export type Currency = 'XTR' | 'TON';

/**
 * This project currently implements ONE game: Pot Roulette.
 * Users place stakes into a pot; the wheel has N segments (N = unique users).
 * Segment size is proportional to user stake amount.
 * One winner takes the whole pot minus a 1% fee (configurable in bps).
 */

export type RoomKind = 'GLOBAL' | 'PRIVATE';

export type RoomStatus = 'ACTIVE' | 'DISABLED';

export type RoundStatus = 'OPEN' | 'LOCKED' | 'SETTLED' | 'CANCELLED' | 'REFUNDED';

export type PaymentProvider = 'STARS' | 'TON';

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'BET_LOCK'
  | 'PAYOUT'
  | 'REFUND'
  | 'HOUSE_FEE';

export type ProvablyFairCommit = {
  serverSeedHash: string;
  nonce: number;
};

export type ProvablyFairReveal = {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  digest: string; // HMAC digest used to derive winner
};

export type PotRouletteOutcome = {
  winnerUserId: string;
  totalPotNano: string;
  feeNano: string;
  payoutNano: string;
  // in [0, totalWeight)
  winningTicket: string;
  totalWeight: string;
};

export type RoomPublic = {
  id: string;
  kind: RoomKind;
  currency: Currency;
  title: string;
  status: RoomStatus;

  maxPlayers: number | null; // null => unlimited
  minBet: string; // decimal string
  maxBet: string | null; // null => unlimited
  maxTotalPot: string | null; // null => unlimited

  roundDurationSeconds: number;
  feeBps: number;

  createdAt: string;

  // current round snapshot
  round: {
    id: string;
    status: RoundStatus;
    endsAt: string;
    totalPot: string;
    participantsCount: number;
  };
};

export type RoomDetails = RoomPublic & {
  participants: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    amount: string;
    percentBps: number; // 0..10000
  }>;

  provablyFair: ProvablyFairCommit;

  settled?: {
    outcome: PotRouletteOutcome;
    reveal: ProvablyFairReveal;
    settledAt: string;
  } | null;
};

export type HistoryItem = {
  roundId: string;
  roomId: string;
  roomTitle: string;
  currency: Currency;
  totalPot: string;
  fee: string;
  payout: string;
  winnerUserId: string;
  winnerDisplayName: string;
  endedAt: string;
  settledAt: string;

  provablyFair: {
    serverSeedHash: string;
    clientSeed: string;
    serverSeed: string;
    nonce: number;
    digest: string;
  };
};
