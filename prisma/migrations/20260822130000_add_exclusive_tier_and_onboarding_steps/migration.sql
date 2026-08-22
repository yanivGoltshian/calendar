-- Additive, backward-compatible migration for the three-tier communication model
-- and onboarding-driven visual levels. Safe to apply while the previous image runs:
-- the old code never references the new enum values nor the new nullable column.

-- AlterEnum: add the EXCLUSIVE member to RequestedPlan (quote form).
-- PostgreSQL requires ALTER TYPE ... ADD VALUE to be committed before the new value
-- can be referenced; it is not referenced elsewhere in this migration.
ALTER TYPE "RequestedPlan" ADD VALUE 'EXCLUSIVE';

-- AlterEnum: add the exclusive member to BusinessPlan (internal plan).
ALTER TYPE "BusinessPlan" ADD VALUE 'exclusive';

-- AlterTable: granular onboarding-step tracking that drives the public page visual level.
ALTER TABLE "BusinessSettings" ADD COLUMN "onboardingSteps" JSONB;
