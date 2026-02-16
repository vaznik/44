import { prisma } from '../prisma';
import { withLock, redis } from '../redis';
import { roomQueue } from '../bull';
import { commitHash, makeServerSeed, pickWeightedWinner } from '@tgcasino/shared';
import { Currency, RoomKind, RoomStatus, StartMode } from '@prisma/client';
import { fromNano, toNano } from './ledger';
import { env } from '../env';
import { idempotencyGuard } from './idempotency';

const BET_CUTOFF_MS = 1200; // stop accepting bets ~1.2s before end to avoid race conditions

function nowMs() {
  return Date.now();
}

function addSeconds(d: Date, seconds: number) {
  return new Date(d.getTime() + seconds * 1000);
}

async function getHouseUserId(): Promise<string> {
  const u = await prisma.user.findUnique({ where: { tgUserId: env.houseTgUserId } });
  if (!u) throw new Error('HOUSE_USER_MISSING');
  return u.id;
}

export async function ensureBootstrap() {
  // 1) Ensure house/admin user exists (fee recipient)
  await prisma.user.upsert({
    where: { tgUserId: env.houseTgUserId },
    create: {
      tgUserId: env.houseTgUserId,
      username: 'house',
      firstName: 'House',
      isAdmin: true,
      notifications: false,
      language: 'en',
    },
    update: { isAdmin: true },
  });

  // 2) Ensure single global room exists
  const global = await prisma.room.findFirst({
    where: { kind: 'GLOBAL', currency: env.globalCurrency as any, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });

  const room =
    global ??
    (await prisma.room.create({
      data: {
        kind: 'GLOBAL',
        status: 'ACTIVE',
        currency: env.globalCurrency as any,
        title: env.globalCurrency === 'XTR' ? 'Общая комната (Stars)' : 'Общая комната (TON)',
        maxPlayers: null, // unlimited
        minBetNano: BigInt(0),
        maxBetNano: null,
        maxTotalPotNano: null,
        roundDurationSeconds: env.globalRoundDurationSeconds,
        startMode: 'TIMER',
        feeBps: env.houseFeeBps,
      },
    }));

  // 3) Ensure the room has an open round and that a settle job exists (best-effort)
  await ensureOpenRound(room.id);
}

export async function ensureOpenRound(roomId: string) {
  return withLock(`ensure_round:${roomId}`, 8000, async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.status !== 'ACTIVE') return;

    const open = await prisma.round.findFirst({
      where: { roomId, status: { in: ['OPEN', 'LOCKED'] } },
      orderBy: { startedAt: 'desc' },
    });

    if (open) {
      // If round already ended but not settled (server restart), schedule immediate settle
      if (open.endsAt.getTime() <= nowMs() + 50) {
        await roomQueue.add('settle_round', { roundId: open.id }, { delay: 100, removeOnComplete: true, removeOnFail: true });
      } else {
        const delay = Math.max(0, open.endsAt.getTime() - nowMs() + 50);
        await roomQueue.add('settle_round', { roundId: open.id }, { delay, removeOnComplete: true, removeOnFail: true });
      }
      return;
    }

    const startedAt = new Date();
    const endsAt = addSeconds(startedAt, room.roundDurationSeconds);

    const serverSeed = makeServerSeed();
    const round = await prisma.round.create({
      data: {
        roomId,
        status: 'OPEN',
        startedAt,
        endsAt,
        serverSeedHash: commitHash(serverSeed),
        serverSeed,
        nonce: 1,
      },
    });

    const delay = Math.max(0, endsAt.getTime() - nowMs() + 50);
    await roomQueue.add('settle_round', { roundId: round.id }, { delay, removeOnComplete: true, removeOnFail: true });
  });
}

export async function listRooms(params: { currency?: Currency; kind?: RoomKind }) {
  const where: any = { status: 'ACTIVE' };
  if (params.currency) where.currency = params.currency;
  if (params.kind) where.kind = params.kind;

  const rooms = await prisma.room.findMany({
    where,
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  });

  // Ensure each active room has open round (best-effort)
  await Promise.all(rooms.slice(0, 20).map((r) => ensureOpenRound(r.id).catch(() => {})));

  const rounds = await prisma.round.findMany({
    where: { roomId: { in: rooms.map((r) => r.id) }, status: { in: ['OPEN', 'LOCKED'] } },
    orderBy: { startedAt: 'desc' },
  });
  const roundByRoom = new Map<string, typeof rounds[number]>();
  for (const rd of rounds) {
    if (!roundByRoom.has(rd.roomId)) roundByRoom.set(rd.roomId, rd);
  }

  const roundIds = Array.from(roundByRoom.values()).map((r) => r.id);
  const counts = roundIds.length
    ? await prisma.roundParticipant.groupBy({
        by: ['roundId'],
        where: { roundId: { in: roundIds } },
        _count: { _all: true },
      })
    : [];
  const countByRound = new Map<string, number>();
  for (const c of counts) countByRound.set(c.roundId, c._count._all);

  return rooms.map((r) => {
    const rd = roundByRoom.get(r.id);
    const participantsCount = rd ? (countByRound.get(rd.id) ?? 0) : 0;
    return {
      id: r.id,
      kind: r.kind,
      currency: r.currency,
      title: r.title,
      status: r.status,
      maxPlayers: r.maxPlayers,
      minBet: fromNano(r.minBetNano as any),
      maxBet: r.maxBetNano != null ? fromNano(r.maxBetNano as any) : null,
      maxTotalPot: r.maxTotalPotNano != null ? fromNano(r.maxTotalPotNano as any) : null,
      roundDurationSeconds: r.roundDurationSeconds,
      feeBps: r.feeBps,
      createdAt: r.createdAt.toISOString(),
      round: rd
        ? {
            id: rd.id,
            status: rd.status,
            endsAt: rd.endsAt.toISOString(),
            totalPot: fromNano(rd.totalPotNano as any),
            participantsCount,
          }
        : {
            id: 'none',
            status: 'OPEN',
            endsAt: new Date().toISOString(),
            totalPot: '0',
            participantsCount: 0,
          },
    };
  });
}

export async function createPrivateRoom(params: {
  userId: string;
  currency: Currency;
  title?: string;
  maxPlayers?: number | null;
  minBet?: string;
  maxBet?: string | null;
  maxTotalPot?: string | null;
  roundDurationSeconds?: number;
  startMode?: StartMode;
}) {
  const title = params.title?.trim() || 'Private room';
  const maxPlayers = params.maxPlayers ?? 10;

  const minBetNano = params.minBet ? toNano(params.currency, params.minBet) : BigInt(0);
  const maxBetNano = params.maxBet ? toNano(params.currency, params.maxBet) : null;
  const maxTotalPotNano = params.maxTotalPot ? toNano(params.currency, params.maxTotalPot) : null;

  const room = await prisma.room.create({
    data: {
      kind: 'PRIVATE',
      status: 'ACTIVE',
      currency: params.currency,
      title,
      createdByUserId: params.userId,
      maxPlayers,
      minBetNano,
      maxBetNano,
      maxTotalPotNano,
      roundDurationSeconds: params.roundDurationSeconds ?? 30,
      startMode: params.startMode ?? 'TIMER',
      feeBps: env.houseFeeBps,
    },
  });

  await ensureOpenRound(room.id);
  return room.id;
}

export async function roomDetails(roomId: string) {
  await ensureOpenRound(roomId);

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const round = await prisma.round.findFirst({
    where: { roomId, status: { in: ['OPEN', 'LOCKED'] } },
    orderBy: { startedAt: 'desc' },
  });

  if (!round) throw new Error('ROUND_NOT_FOUND');

  const parts = await prisma.roundParticipant.findMany({
    where: { roundId: round.id },
    include: { user: true },
    orderBy: [{ amountNano: 'desc' }, { joinedAt: 'asc' }],
    take: 200,
  });

  const totalPot = round.totalPotNano as any as bigint;
  const total = totalPot > BigInt(0) ? totalPot : BigInt(0);

  const participants = parts.map((p) => {
    const amount = p.amountNano as any as bigint;
    const percentBps = total > BigInt(0) ? Number((amount * BigInt(10000)) / total) : 0;
    return {
      userId: p.userId,
      displayName: p.user.firstName || p.user.username || String(p.user.tgUserId),
      avatarUrl: p.user.photoUrl,
      amount: fromNano(amount),
      percentBps,
    };
  });

  // last settled round (for reveal/proof)
  const lastSettled = await prisma.round.findFirst({
    where: { roomId, status: 'SETTLED' },
    orderBy: { settledAt: 'desc' },
  });

  const settled =
    lastSettled && lastSettled.settledAt && lastSettled.winnerUserId && lastSettled.serverSeed && lastSettled.clientSeedAgg && lastSettled.digest
      ? {
          outcome: {
            winnerUserId: lastSettled.winnerUserId,
            totalPotNano: String(lastSettled.totalPotNano),
            feeNano: String(lastSettled.feeNano),
            payoutNano: String(lastSettled.payoutNano),
            winningTicket: String(lastSettled.winningTicket),
            totalWeight: String(lastSettled.totalWeight),
          },
          reveal: {
            serverSeed: lastSettled.serverSeed,
            clientSeed: lastSettled.clientSeedAgg,
            nonce: lastSettled.nonce,
            digest: lastSettled.digest,
          },
          settledAt: lastSettled.settledAt.toISOString(),
        }
      : null;

  return {
    id: room.id,
    kind: room.kind,
    currency: room.currency,
    title: room.title,
    status: room.status,
    maxPlayers: room.maxPlayers,
    minBet: fromNano(room.minBetNano as any),
    maxBet: room.maxBetNano != null ? fromNano(room.maxBetNano as any) : null,
    maxTotalPot: room.maxTotalPotNano != null ? fromNano(room.maxTotalPotNano as any) : null,
    roundDurationSeconds: room.roundDurationSeconds,
    feeBps: room.feeBps,
    createdAt: room.createdAt.toISOString(),
    round: {
      id: round.id,
      status: round.status,
      endsAt: round.endsAt.toISOString(),
      totalPot: fromNano(round.totalPotNano as any),
      participantsCount: parts.length,
    },
    participants,
    provablyFair: { serverSeedHash: round.serverSeedHash, nonce: round.nonce },
    settled,
  };
}

export async function placeBet(params: {
  roomId: string;
  userId: string;
  amount: string;
  clientSeed: string;
  idempotencyKey?: string;
}) {
  // Redis idempotency: helps against retries on unstable networks.
  // Recommended: generate uuid per click and send as idempotencyKey.
  let idemKey: string | null = null;
  if (params.idempotencyKey) {
    idemKey = `bet:${params.userId}:${params.roomId}:${params.idempotencyKey}`;
    const first = await idempotencyGuard(idemKey);
    if (!first) return { ok: true, already: true };
  }

  try {
    return await withLock(`bet_room:${params.roomId}`, 8000, async () => {
    const room = await prisma.room.findUnique({ where: { id: params.roomId } });
    if (!room || room.status !== 'ACTIVE') throw new Error('ROOM_NOT_ACTIVE');

    await ensureOpenRound(room.id);

    const round = await prisma.round.findFirst({
      where: { roomId: room.id, status: { in: ['OPEN', 'LOCKED'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!round) throw new Error('ROUND_NOT_FOUND');

    const msLeft = round.endsAt.getTime() - nowMs();
    if (msLeft <= BET_CUTOFF_MS) throw new Error('ROUND_CLOSED');

    const amountNano = toNano(room.currency, params.amount);
    if (amountNano <= BigInt(0)) throw new Error('BAD_AMOUNT');

    // Stars must be integers (no fractional stars)
    if (room.currency === 'XTR' && amountNano % BigInt(1_000_000_000) !== BigInt(0)) {
      throw new Error('XTR_INTEGER_ONLY');
    }

    // Room bet caps
    if (room.minBetNano && amountNano < (room.minBetNano as any as bigint)) throw new Error('BET_TOO_SMALL');
    if (room.maxBetNano != null && amountNano > (room.maxBetNano as any as bigint)) throw new Error('BET_TOO_LARGE');

    const existing = await prisma.roundParticipant.findUnique({
      where: { roundId_userId: { roundId: round.id, userId: params.userId } },
    });

    if (!existing) {
      if (room.maxPlayers != null) {
        const count = await prisma.roundParticipant.count({ where: { roundId: round.id } });
        if (count >= room.maxPlayers) throw new Error('ROOM_FULL');
      }
    } else {
      if (existing.clientSeed !== params.clientSeed) throw new Error('CLIENT_SEED_MISMATCH');
      if (existing.betCount >= 100) throw new Error('BET_LIMIT_REACHED');
    }

    if (room.maxTotalPotNano != null) {
      const next = (round.totalPotNano as any as bigint) + amountNano;
      if (next > (room.maxTotalPotNano as any as bigint)) throw new Error('POT_LIMIT_REACHED');
    }

    // Balance check (ledger-only). Protected by per-user lock above.
    const account = await prisma.account.findUnique({ where: { userId_currency: { userId: params.userId, currency: room.currency } } });
    const balance =
      account
        ? ((await prisma.ledgerEntry.aggregate({
            where: { accountId: account.id },
            _sum: { amountNano: true },
          }))._sum.amountNano ?? BigInt(0))
        : BigInt(0);
    if ((balance as any as bigint) < amountNano) throw new Error('INSUFFICIENT_FUNDS');

    await prisma.$transaction(async (tx) => {
      const acc = await tx.account.upsert({
        where: { userId_currency: { userId: params.userId, currency: room.currency } },
        create: { userId: params.userId, currency: room.currency },
        update: {},
      });

      await tx.ledgerEntry.create({
        data: {
          accountId: acc.id,
          type: 'BET_LOCK',
          amountNano: -amountNano,
          refType: 'ROUND_BET',
          refId: round.id,
        },
      });

      await tx.roundParticipant.upsert({
        where: { roundId_userId: { roundId: round.id, userId: params.userId } },
        create: {
          roundId: round.id,
          userId: params.userId,
          clientSeed: params.clientSeed,
          amountNano,
          betCount: 1,
          lastBetAt: new Date(),
        },
        update: {
          amountNano: { increment: amountNano } as any,
          betCount: { increment: 1 },
          lastBetAt: new Date(),
        },
      });

      await tx.round.update({
        where: { id: round.id },
        data: { totalPotNano: { increment: amountNano } as any },
      });
    });

    if (room.startMode === 'FILL' && room.maxPlayers != null) {
      const count = await prisma.roundParticipant.count({ where: { roundId: round.id } });
      if (count >= room.maxPlayers) {
        await prisma.round.update({
          where: { id: round.id },
          data: { status: 'LOCKED', lockedAt: new Date(), endsAt: new Date(Date.now() + 1500) },
        });
        await roomQueue.add('settle_round', { roundId: round.id }, { delay: 1600, removeOnComplete: true, removeOnFail: true });
      }
    }

    return { ok: true };
  });
  } catch (e) {
    if (idemKey) await redis.del(idemKey);
    throw e;
  }
}

export async function settleRound(roundId: string) {
  return withLock(`settle:${roundId}`, 15000, async () => {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { room: true },
    });
    if (!round) return;

    if (!['OPEN', 'LOCKED'].includes(round.status)) return;
    if (round.endsAt.getTime() > nowMs() + 50) return; // not time yet

    const parts = await prisma.roundParticipant.findMany({
      where: { roundId },
      orderBy: [{ joinedAt: 'asc' }],
    });

    // Not enough players => refund everyone who joined (0 or 1)
    if (parts.length < 2) {
      await prisma.$transaction(async (tx) => {
        await tx.round.update({
          where: { id: roundId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });

        for (const p of parts) {
          const acc = await tx.account.upsert({
            where: { userId_currency: { userId: p.userId, currency: round.room.currency } },
            create: { userId: p.userId, currency: round.room.currency },
            update: {},
          });
          await tx.ledgerEntry.create({
            data: {
              accountId: acc.id,
              type: 'REFUND',
              amountNano: p.amountNano as any,
              refType: 'ROUND_REFUND',
              refId: roundId,
            },
          });
        }

        await tx.round.update({
          where: { id: roundId },
          data: { status: 'REFUNDED', settledAt: new Date() },
        });
      });

      await ensureOpenRound(round.roomId);
      return;
    }

    // lock round
    await prisma.round.update({ where: { id: roundId }, data: { status: 'LOCKED', lockedAt: new Date() } });

    const serverSeed = round.serverSeed!;
    const nonce = round.nonce;

    // Deterministic clientSeed aggregate (sorted by userId, prevents order manipulation)
    const ordered = [...parts].sort((a, b) => a.userId.localeCompare(b.userId));
    const clientSeedAgg = ordered.map((p) => p.clientSeed).join('|');

    const players = ordered.map((p) => ({ userId: p.userId, weight: p.amountNano as any as bigint }));

    const picked = pickWeightedWinner({
      serverSeed,
      clientSeed: clientSeedAgg,
      nonce,
      roundId: round.id,
      players,
    });

    const totalPot = players.reduce((a, p) => a + p.weight, BigInt(0));
    const fee = (totalPot * BigInt(round.room.feeBps)) / BigInt(10000);
    const payout = totalPot - fee;

    const houseUserId = await getHouseUserId();

    await prisma.$transaction(async (tx) => {
      // payout to winner
      const winnerAcc = await tx.account.upsert({
        where: { userId_currency: { userId: picked.winnerUserId, currency: round.room.currency } },
        create: { userId: picked.winnerUserId, currency: round.room.currency },
        update: {},
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: winnerAcc.id,
          type: 'PAYOUT',
          amountNano: payout,
          refType: 'ROUND_PAYOUT',
          refId: round.id,
        },
      });

      // fee to house
      if (fee > BigInt(0)) {
        const houseAcc = await tx.account.upsert({
          where: { userId_currency: { userId: houseUserId, currency: round.room.currency } },
          create: { userId: houseUserId, currency: round.room.currency },
          update: {},
        });
        await tx.ledgerEntry.create({
          data: {
            accountId: houseAcc.id,
            type: 'HOUSE_FEE',
            amountNano: fee,
            refType: 'ROUND_FEE',
            refId: round.id,
          },
        });
      }

      await tx.round.update({
        where: { id: round.id },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
          serverSeed: serverSeed,
          clientSeedAgg,
          digest: picked.digest,
          winnerUserId: picked.winnerUserId,
          totalPotNano: totalPot,
          feeNano: fee,
          payoutNano: payout,
          winningTicket: picked.winningTicket,
          totalWeight: picked.totalWeight,
        },
      });
    });

    await ensureOpenRound(round.roomId);
  });
}

export async function history(userId: string) {
  const rows = await prisma.roundParticipant.findMany({
    where: { userId, round: { status: 'SETTLED' } },
    include: { round: { include: { room: true, winnerUser: true } } },
    orderBy: { round: { settledAt: 'desc' } },
    take: 100,
  });

  return rows
    .map((rp) => {
      const r = rp.round;
      if (!r.settledAt || !r.winnerUserId || !r.serverSeed || !r.clientSeedAgg || !r.digest) return null;
      const winnerName = r.winnerUser?.firstName || r.winnerUser?.username || (r.winnerUser ? String(r.winnerUser.tgUserId) : 'winner');
      return {
        roundId: r.id,
        roomId: r.roomId,
        roomTitle: r.room.title,
        currency: r.room.currency,
        totalPot: fromNano(r.totalPotNano as any),
        fee: fromNano(r.feeNano as any),
        payout: fromNano(r.payoutNano as any),
        winnerUserId: r.winnerUserId,
        winnerDisplayName: winnerName,
        endedAt: r.endsAt.toISOString(),
        settledAt: r.settledAt.toISOString(),
        provablyFair: {
          serverSeedHash: r.serverSeedHash,
          clientSeed: r.clientSeedAgg,
          serverSeed: r.serverSeed,
          nonce: r.nonce,
          digest: r.digest,
        },
      };
    })
    .filter(Boolean);
}
