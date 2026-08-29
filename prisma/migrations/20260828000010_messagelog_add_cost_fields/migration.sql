-- Additive-only migration: monthly SMS cost guard accounting on "MessageLog".
-- Adds two columns:
--   "costAgorot"  (Int, default 0)     — the accrued cost of this message in agorot,
--                                        the basis for summing each business's monthly spend.
--   "countsToCap" (Boolean, default true) — whether this message counts toward the
--                                        business's monthly cost cap. Paid client SMS = true;
--                                        owner phone-verification SMS = false (exempt bucket).
-- Safe against existing data: every existing MessageLog row gets costAgorot = 0
-- (contributes nothing to any cap) and countsToCap = true, so historical rows never
-- retroactively block a business. Adds a supporting composite index for the monthly
-- usage query. Does not touch any other table, column, or enum.

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "costAgorot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "countsToCap" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "MessageLog_businessId_countsToCap_createdAt_idx" ON "MessageLog"("businessId", "countsToCap", "createdAt");
