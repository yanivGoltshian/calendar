-- Additive, backward-compatible migration: add an optional EMAIL identity to
-- the shared "User" table and relax the NOT NULL on phone so users/clients can
-- be email-only. No columns are dropped and no existing rows are invalidated —
-- existing phone-based users/clients keep working unchanged. The rule
-- "at least one of phone/email" is enforced in the application layer, NOT the DB.
-- Postgres allows multiple NULLs under a unique index, so nullable-unique is safe
-- (including the composite unique on Client(businessId, phone)).
-- Does not touch demo-barbershop rows or the OtpCode table.

-- User: relax phone to nullable, add email (nullable-unique) + emailVerified.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);

-- CreateIndex (unique on User.email; matches Prisma's "User_email_key" convention)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Client: relax phone to nullable so email-only clients can be booked.
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
