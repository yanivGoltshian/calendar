-- AlterTable
-- ברירות מחדל חדשות למדיניות הזמנה של עסק חדש (משפיע רק על שורות עתידיות, לא על עסקים קיימים)
ALTER TABLE "BusinessSettings" ALTER COLUMN "minLeadTimeMinutes" SET DEFAULT 0,
ALTER COLUMN "cancellationWindowHours" SET DEFAULT 0,
ALTER COLUMN "slotGranularityMinutes" SET DEFAULT 30,
ALTER COLUMN "maxAdvanceBookingDays" SET DEFAULT 30;
