ALTER TABLE "Business"
  ADD COLUMN "businessImportSourceUrl" TEXT,
  ADD COLUMN "businessImportDraft" JSONB,
  ADD COLUMN "businessImportedAt" TIMESTAMP(3);
