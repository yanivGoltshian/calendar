-- Remove dead custom-text columns from BusinessSettings.
-- These free-text fields had no downstream consumer.
ALTER TABLE "BusinessSettings" DROP COLUMN "welcomeMessage",
DROP COLUMN "confirmationMessage",
DROP COLUMN "policyText";
