-- AlterEnum
-- Adds the 'exclusive' member to the BusinessPlan enum. Kept in its own migration
-- because PostgreSQL requires ALTER TYPE ... ADD VALUE to be committed before the
-- new value can be referenced (e.g. as a column default or in later logic).
-- Additive-only: every existing Business row keeps its current plan; no data changes.
ALTER TYPE "BusinessPlan" ADD VALUE 'exclusive';
