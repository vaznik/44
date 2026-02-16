import { verifyInitData } from '@tgcasino/shared';
import { env } from '../env';
import { prisma } from '../prisma';
import { linkDevice } from './antiMulti';

export type TgAuthContext = {
  userId: string;
  tgUserId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  startParam?: string | null;
  deviceId?: string | null; // hashed (server-side)
};

export async function ensureHouseUser() {
  // We need a concrete user record to receive the 1% house fee even if the admin never opened the app yet.
  const tgUserId = env.houseTgUserId;

  await prisma.user.upsert({
    where: { tgUserId },
    create: {
      tgUserId,
      username: 'house',
      firstName: 'House',
      lastName: null,
      photoUrl: null,
      language: 'en',
      notifications: false,
      isAdmin: true,
    },
    update: { isAdmin: true },
  });
}

export async function authFromInitData(initData: string, rawDeviceId?: string): Promise<TgAuthContext> {
  const res = verifyInitData(initData, env.telegramBotTokenForInitData);
  if (!res.ok) throw new Error('INITDATA_INVALID:' + res.reason);

  const userJson = res.data['user'];
  if (!userJson) throw new Error('INITDATA_NO_USER');

  const u = JSON.parse(userJson);
  const tgUserId = BigInt(u.id);
  const startParam = (res.data['start_param'] ?? '') as string;

  const isAdmin = tgUserId === env.houseTgUserId;

  const user = await prisma.user.upsert({
    where: { tgUserId },
    create: {
      tgUserId,
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      lastName: u.last_name ?? null,
      photoUrl: u.photo_url ?? null,
      language: u.language_code ?? 'en',
      notifications: true,
      isAdmin,
    },
    update: {
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      lastName: u.last_name ?? null,
      photoUrl: u.photo_url ?? null,
      ...(isAdmin ? { isAdmin: true } : {}),
    },
  });

  const deviceId = rawDeviceId ? await linkDevice(user.id, rawDeviceId) : null;

  return {
    userId: user.id,
    tgUserId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    startParam: startParam || null,
    deviceId,
  };
}
