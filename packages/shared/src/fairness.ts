import crypto from 'crypto';
import { createHmac, createHash } from "node:crypto";

export function sha256Hex(data: string) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export function randomBytesHex(n: number) {
  return crypto.randomBytes(n).toString('hex');
}

export function makeServerSeed() {
  return randomBytesHex(32);
}

export function commitHash(serverSeed: string) {
  return sha256Hex(serverSeed);
}

export function hmacSha256Hex(key: string, msg: string) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
}

function hexToBigInt(hex: string) {
  return BigInt('0x' + hex);
}

/**
 * Pot Roulette (weighted wheel).
 * - server commits serverSeedHash (sha256(serverSeed))
 * - each participant provides clientSeed when placing first bet in the round
 * - at settle we build clientSeedAggregate (deterministic order)
 * - winner ticket = HMAC(serverSeed, `${clientSeedAgg}:${nonce}:${roundId}`) % totalWeight
 * - walk cumulative weights to pick winner
 */
export function pickWeightedWinner(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  roundId: string;
  players: Array<{ userId: string; weight: bigint }>;
}): {
  winnerUserId: string;
  digest: string;
  winningTicket: bigint;
  totalWeight: bigint;
} {
  const { serverSeed, clientSeed, nonce, roundId, players } = params;
  if (!players.length) return { winnerUserId: '', digest: '', winningTicket: BigInt(0), totalWeight: BigInt(0) };

  const digest = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${roundId}`);
  const totalWeight = players.reduce((a, p) => a + p.weight, BigInt(0));
  const ticket = totalWeight === BigInt(0) ? BigInt(0) : hexToBigInt(digest) % totalWeight;

  let acc = BigInt(0);
  for (const p of players) {
    acc += p.weight;
    if (ticket < acc) return { winnerUserId: p.userId, digest, winningTicket: ticket, totalWeight };
  }
  return { winnerUserId: players[players.length - 1]!.userId, digest, winningTicket: ticket, totalWeight };
}
