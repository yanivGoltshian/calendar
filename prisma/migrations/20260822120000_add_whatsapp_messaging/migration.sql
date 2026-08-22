-- Additive-only migration: WhatsApp messaging via Azure Communication Services
-- (Exclusive-tier channel) + per-business monthly cost governance.
--
-- Adds two enums ("WhatsAppMessageType", "WhatsAppLogStatus"), one new table
-- ("WhatsAppMessageLog") for the message/cost audit trail, and five additive
-- nullable/default columns on "Business" that hold the per-calendar-month cost
-- accumulator and the warn/block/override governance state (all in agorot).
--
-- Timestamp 20260822120000 orders this migration AFTER the account-deletion and
-- tier migrations (20260822000000_*) so a rebased main applies all three in
-- order. Safe against existing data: does not touch or drop any existing table,
-- column, or enum; every new column is nullable or has a default.

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('OTP', 'CONFIRMATION', 'REMINDER', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "WhatsAppLogStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED', 'BLOCKED');

-- AlterTable (additive governance columns on Business; all defaulted/nullable)
ALTER TABLE "Business" ADD COLUMN     "monthlyWhatsappCostAgorot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappCostMonth" TEXT,
ADD COLUMN     "whatsappBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappWarn40SentForMonth" TEXT,
ADD COLUMN     "whatsappOverrideApprovedForMonth" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "messageType" "WhatsAppMessageType" NOT NULL,
    "templateName" TEXT,
    "status" "WhatsAppLogStatus" NOT NULL,
    "providerMessageId" TEXT,
    "estimatedCostAgorot" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_businessId_month_idx" ON "WhatsAppMessageLog"("businessId", "month");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_businessId_createdAt_idx" ON "WhatsAppMessageLog"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppMessageLog" ADD CONSTRAINT "WhatsAppMessageLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
