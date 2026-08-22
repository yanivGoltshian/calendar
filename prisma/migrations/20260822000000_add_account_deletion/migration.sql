-- Additive-only migration: account (subscription) deletion with a grace period.
-- Adds a new enum "AccountStatus" and three columns on "Business":
--   "accountStatus" (defaulted enum, NOT NULL, default ACTIVE),
--   "deletionRequestedAt" (nullable timestamp) and
--   "purgeScheduledFor" (nullable timestamp).
-- Safe against existing data: every existing/new row defaults to ACTIVE and the two
-- timestamps stay NULL, so nothing is hidden or purged unless a deletion is requested.
-- Does not touch any other table, column, or enum.

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_DELETION');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "purgeScheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Business_accountStatus_purgeScheduledFor_idx" ON "Business"("accountStatus", "purgeScheduledFor");
