-- Additive-only migration: plan upgrade quote requests (Standard / Premium).
-- Adds two enums ("RequestedPlan", "InquiryStatus") and one new table "PlanInquiry".
-- The table stores each quote request so nothing is lost even if an owner
-- notification channel (email / WhatsApp) fails. Safe against existing data:
-- does not touch any existing table, column, or enum.

-- CreateEnum
CREATE TYPE "RequestedPlan" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'NOTIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "PlanInquiry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "publicPageUrl" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestedPlan" "RequestedPlan" NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "emailedAt" TIMESTAMP(3),
    "whatsappedAt" TIMESTAMP(3),
    "notifyError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanInquiry_businessId_createdAt_idx" ON "PlanInquiry"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanInquiry_status_idx" ON "PlanInquiry"("status");

-- AddForeignKey
ALTER TABLE "PlanInquiry" ADD CONSTRAINT "PlanInquiry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
