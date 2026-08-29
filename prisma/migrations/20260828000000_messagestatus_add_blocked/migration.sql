-- AlterEnum
-- Adds the 'BLOCKED' member to the MessageStatus enum, used to record a paid
-- client SMS that was refused before sending because the business hit its monthly
-- cost cap. Kept in its own migration because PostgreSQL requires
-- ALTER TYPE ... ADD VALUE to be committed before the new value can be referenced
-- by later logic. Additive-only: no existing MessageLog row is changed.
ALTER TYPE "MessageStatus" ADD VALUE 'BLOCKED';
