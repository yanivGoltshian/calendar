-- Additive-only migration: owner identity for NextAuth (Google/email) owners.
-- Safe against existing data; does not touch the phone-based "User" table
-- and does not alter the demo business (demo-barbershop) rows.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Business_ownerEmail_idx" ON "Business"("ownerEmail");
