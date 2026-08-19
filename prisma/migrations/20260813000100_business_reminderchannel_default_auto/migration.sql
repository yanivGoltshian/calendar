-- AlterTable
-- Switches the default reminder channel for newly created businesses to AUTO, so
-- the delivery channel is derived from how each client registered (email or phone).
-- Only the column DEFAULT changes; existing Business rows are intentionally left as-is
-- (no backfill). Separate migration so the AUTO enum value is already committed.
ALTER TABLE "Business" ALTER COLUMN "reminderChannel" SET DEFAULT 'AUTO';
