-- Remove dead settings columns from BusinessSettings in a single migration.
-- Three groups, all verified to have no downstream consumer:
--   1. Custom texts (welcomeMessage/confirmationMessage/policyText): free-text
--      fields read back only into the settings form; never rendered or sent.
--   2. Transparency toggles (showPricesPublic/showDurationPublic/showStaffPublic):
--      the public page always shows prices, duration and staff.
--   3. Dead reminder checkboxes (remindersEnabled/confirmationRequired): no
--      consumer in book/route.ts or reminders/send.ts, which use only
--      reminderChannel and reminderLeadHours (both retained).
ALTER TABLE "BusinessSettings" DROP COLUMN "welcomeMessage",
DROP COLUMN "confirmationMessage",
DROP COLUMN "policyText",
DROP COLUMN "showPricesPublic",
DROP COLUMN "showDurationPublic",
DROP COLUMN "showStaffPublic",
DROP COLUMN "remindersEnabled",
DROP COLUMN "confirmationRequired";
