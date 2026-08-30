-- AlterEnum
-- Adds the BOTH member to the ReminderChannel enum (email + SMS together, an
-- Exclusive-plan option). Kept in its own migration because PostgreSQL requires
-- ALTER TYPE ... ADD VALUE to be committed before the new value can be referenced.
ALTER TYPE "ReminderChannel" ADD VALUE 'BOTH';
