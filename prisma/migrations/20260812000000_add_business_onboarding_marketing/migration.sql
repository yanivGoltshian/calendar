-- Additive-only migration: onboarding marketing questions (Epic D2), calmark-style.
-- Two nullable columns on "Business": which calendar the owner used before, and how
-- they heard about us. Safe against existing data; does not touch existing rows or
-- the demo business (demo-barbershop), and does not alter any other table.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "priorCalendar" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
