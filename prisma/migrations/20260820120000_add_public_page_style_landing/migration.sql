-- Additive-only migration: public business page style + landing content.
-- Adds a new enum "PublicPageStyle" and two columns on "Business":
--   "publicPageStyle" (defaulted enum, NOT NULL) and "landingContent" (nullable JSONB).
-- Safe against existing data: existing/new rows default to BOOKING and landingContent
-- stays NULL. Does not touch any other table or existing enum.

-- CreateEnum
CREATE TYPE "PublicPageStyle" AS ENUM ('BOOKING', 'LANDING');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "publicPageStyle" "PublicPageStyle" NOT NULL DEFAULT 'BOOKING',
ADD COLUMN     "landingContent" JSONB;
