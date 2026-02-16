import crypto from 'crypto';
import { env } from '../env';
import { prisma } from '../prisma';

export function deviceFingerprint(rawDeviceId: string) {
  // Soft fingerprint hash (we never store the raw device id).
  return crypto.createHash('sha256').update(env.deviceFingerprintSalt + ':' + rawDeviceId).digest('hex');
}

export async function linkDevice(userId: string, rawDeviceId: string) {
  const deviceId = deviceFingerprint(rawDeviceId);
  await prisma.deviceLink.upsert({
    where: { deviceId_userId: { deviceId, userId } },
    create: { deviceId, userId },
    update: { lastSeenAt: new Date() },
  });
  return deviceId;
}
