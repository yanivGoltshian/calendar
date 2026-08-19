-- AlterEnum
-- Adds the AUTO member to the ReminderChannel enum. Kept in its own migration
-- because PostgreSQL requires ALTER TYPE ... ADD VALUE to be committed before the
-- new value can be referenced (e.g. as a column default in a later migration).
ALTER TYPE "ReminderChannel" ADD VALUE 'AUTO';
