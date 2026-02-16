-- This migration resets the schema for the Pot Roulette-only version.
-- If you are upgrading from an older schema, this will DROP old tables.
-- For production, use a fresh database or back up first.

-- Drop tables (safe on fresh DB)
DROP TABLE IF EXISTS "PaymentIntent" CASCADE;
DROP TABLE IF EXISTS "RoundParticipant" CASCADE;
DROP TABLE IF EXISTS "Round" CASCADE;
DROP TABLE IF EXISTS "Room" CASCADE;
DROP TABLE IF EXISTS "LedgerEntry" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "DeviceLink" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Drop enums if exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Currency') THEN DROP TYPE "Currency"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomKind') THEN DROP TYPE "RoomKind"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomStatus') THEN DROP TYPE "RoomStatus"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StartMode') THEN DROP TYPE "StartMode"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundStatus') THEN DROP TYPE "RoundStatus"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryType') THEN DROP TYPE "LedgerEntryType"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN DROP TYPE "PaymentProvider"; END IF;
END $$;

-- Enums
CREATE TYPE "Currency" AS ENUM ('XTR', 'TON');
CREATE TYPE "RoomKind" AS ENUM ('GLOBAL', 'PRIVATE');
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "StartMode" AS ENUM ('TIMER', 'FILL');
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'BET_LOCK', 'PAYOUT', 'REFUND', 'HOUSE_FEE');
CREATE TYPE "PaymentProvider" AS ENUM ('STARS', 'TON');

-- Tables
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "tgUserId" BIGINT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "photoUrl" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "notifications" BOOLEAN NOT NULL DEFAULT TRUE,
  "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_tgUserId_key" ON "User"("tgUserId");

CREATE TABLE "DeviceLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceLink_deviceId_userId_key" ON "DeviceLink"("deviceId", "userId");
CREATE INDEX "DeviceLink_deviceId_idx" ON "DeviceLink"("deviceId");

ALTER TABLE "DeviceLink" ADD CONSTRAINT "DeviceLink_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" "Currency" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_userId_currency_key" ON "Account"("userId","currency");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "LedgerEntryType" NOT NULL,
  "amountNano" BIGINT NOT NULL,
  "refType" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_refType_refId_idx" ON "LedgerEntry"("refType","refId");
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId","createdAt");

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "kind" "RoomKind" NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" "Currency" NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Room',
  "createdByUserId" TEXT,
  "maxPlayers" INTEGER,
  "minBetNano" BIGINT NOT NULL DEFAULT 0,
  "maxBetNano" BIGINT,
  "maxTotalPotNano" BIGINT,
  "roundDurationSeconds" INTEGER NOT NULL DEFAULT 30,
  "startMode" "StartMode" NOT NULL DEFAULT 'TIMER',
  "feeBps" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Room_kind_currency_status_idx" ON "Room"("kind","currency","status");

ALTER TABLE "Room" ADD CONSTRAINT "Room_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Round" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "lockedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "serverSeedHash" TEXT NOT NULL,
  "serverSeed" TEXT,
  "clientSeedAgg" TEXT,
  "nonce" INTEGER NOT NULL DEFAULT 1,
  "digest" TEXT,
  "winnerUserId" TEXT,
  "totalPotNano" BIGINT NOT NULL DEFAULT 0,
  "feeNano" BIGINT NOT NULL DEFAULT 0,
  "payoutNano" BIGINT NOT NULL DEFAULT 0,
  "winningTicket" BIGINT NOT NULL DEFAULT 0,
  "totalWeight" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Round_roomId_status_idx" ON "Round"("roomId","status");
CREATE INDEX "Round_endsAt_idx" ON "Round"("endsAt");

ALTER TABLE "Round" ADD CONSTRAINT "Round_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Round" ADD CONSTRAINT "Round_winnerUserId_fkey"
FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RoundParticipant" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientSeed" TEXT NOT NULL,
  "amountNano" BIGINT NOT NULL DEFAULT 0,
  "betCount" INTEGER NOT NULL DEFAULT 1,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastBetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoundParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoundParticipant_roundId_userId_key" ON "RoundParticipant"("roundId","userId");
CREATE INDEX "RoundParticipant_roundId_amountNano_idx" ON "RoundParticipant"("roundId","amountNano");

ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentIntent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "currency" "Currency" NOT NULL,
  "amountNano" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "providerRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentIntent_providerRef_key" ON "PaymentIntent"("providerRef");
CREATE INDEX "PaymentIntent_userId_createdAt_idx" ON "PaymentIntent"("userId","createdAt");

ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
