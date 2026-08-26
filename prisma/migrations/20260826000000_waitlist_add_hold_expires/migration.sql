-- Additive-only migration: auto-fill of freed slots from the waitlist.
-- Adds three nullable columns to "WaitlistEntry":
--   "claimToken" (nullable, UNIQUE) — a one-time token for the freed-slot claim link,
--   "holdExpiresAt" (nullable timestamp) — until when the freed slot is held exclusively
--   for the notified customer (first-come-first-served hold window),
--   "heldAppointmentId" (nullable text) — the cancelled appointment whose freed slot is
--   being offered, so the hold-expiry sweep can rebuild the slot and offer the next in line,
--   and the claim flow can recreate the appointment at that exact time/staff/services.
-- Safe against existing data: all columns stay NULL for every existing/new WAITING row,
-- so current behaviour is unchanged until an auto-fill notification is sent.
-- Adds a supporting index on "holdExpiresAt" for the hold-expiry sweep cron.
-- Does not touch any other table, column, or enum.

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "claimToken" TEXT,
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "heldAppointmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_claimToken_key" ON "WaitlistEntry"("claimToken");

-- CreateIndex
CREATE INDEX "WaitlistEntry_holdExpiresAt_idx" ON "WaitlistEntry"("holdExpiresAt");
