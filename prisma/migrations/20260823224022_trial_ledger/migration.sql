-- CreateTable
CREATE TABLE "TrialLedger" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "firstTrialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalTrialEndsAt" TIMESTAMP(3) NOT NULL,
    "registrationCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialLedger_emailHash_key" ON "TrialLedger"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "TrialLedger_phoneHash_key" ON "TrialLedger"("phoneHash");

-- CreateIndex
CREATE INDEX "TrialLedger_emailHash_idx" ON "TrialLedger"("emailHash");

-- CreateIndex
CREATE INDEX "TrialLedger_phoneHash_idx" ON "TrialLedger"("phoneHash");
