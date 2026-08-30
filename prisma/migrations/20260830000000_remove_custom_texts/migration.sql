-- Remove dead settings columns from BusinessSettings in a single migration.
-- Two groups, both verified to have no downstream consumer:
--   1. Custom texts (welcomeMessage/confirmationMessage/policyText): free-text
--      fields read back only into the settings form; never rendered or sent.
--   2. Transparency toggles (showPricesPublic/showDurationPublic/showStaffPublic):
--      the public page always shows prices, duration and staff.
-- The reminders section (remindersEnabled, reminderChannel, reminderLeadHours,
-- confirmationRequired) is retained in full for upcoming operational work.
ALTER TABLE "BusinessSettings" DROP COLUMN "welcomeMessage",
DROP COLUMN "confirmationMessage",
DROP COLUMN "policyText",
DROP COLUMN "showPricesPublic",
DROP COLUMN "showDurationPublic",
DROP COLUMN "showStaffPublic";
