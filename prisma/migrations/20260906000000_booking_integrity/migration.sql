BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Business" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "identityVerifiedAt" TIMESTAMP(3);
DROP INDEX "Client_businessId_phone_key";
CREATE INDEX "Client_businessId_phone_idx" ON "Client"("businessId","phone");
CREATE INDEX "Client_businessId_userId_idx" ON "Client"("businessId","userId");
CREATE UNIQUE INDEX "Client_verified_identity_key" ON "Client"("businessId","userId")
WHERE "identityVerifiedAt" IS NOT NULL AND "userId" IS NOT NULL;
ALTER TABLE "MessageLog"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "reservedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "MessageLog_idempotencyKey_key" ON "MessageLog"("idempotencyKey");
ALTER TABLE "WaitlistEntry"
  ADD COLUMN "notifyClaimToken" TEXT,
  ADD COLUMN "notifyClaimedAt" TIMESTAMP(3),
  ADD COLUMN "notifyError" TEXT;
ALTER TABLE "Appointment"
  ADD COLUMN "reminderClaimToken" TEXT,
  ADD COLUMN "reminderClaimedAt" TIMESTAMP(3),
  ADD COLUMN "reminderLastError" TEXT,
  ADD COLUMN "googleSyncPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "googleSyncClaimToken" TEXT,
  ADD COLUMN "googleSyncClaimedAt" TIMESTAMP(3);
CREATE INDEX "Appointment_googleSyncPending_googleSyncClaimedAt_idx"
  ON "Appointment"("googleSyncPending","googleSyncClaimedAt");

ALTER TABLE "Appointment"
  ADD COLUMN "bookingScope" TEXT,
  ADD COLUMN "bookingKey" TEXT,
  ADD COLUMN "bookingRequestHash" TEXT,
  ADD COLUMN "pendingExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Appointment_bookingScope_bookingKey_key"
  ON "Appointment"("bookingScope", "bookingKey");
CREATE INDEX "Appointment_businessId_status_pendingExpiresAt_idx"
  ON "Appointment"("businessId", "status", "pendingExpiresAt");

-- Existing overlaps require owner-reviewed reconciliation before deployment.
-- This constraint intentionally fails closed rather than cancelling customer data.
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_positive_interval" CHECK ("endAt" > "startAt");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_no_overlap"
  EXCLUDE USING gist ("staffId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'DONE'));

CREATE TABLE "BookingQuota" (
  "key" TEXT PRIMARY KEY,
  "used" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BookingQuota_expiresAt_idx" ON "BookingQuota"("expiresAt");

COMMIT;
