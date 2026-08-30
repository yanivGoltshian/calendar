-- AlterColumn (באג 12): מתג התראות הדחיפה לבעל העסק מוצג דלוק כברירת מחדל.
-- ברירת המחדל של העמודה עוברת ל-true, והשליחה בפועל נשארת no-op חינני עד
-- שהמכשיר משלים הצטרפות מפורשת (הרשאת דפדפן + רישום מנוי), ולכן זה בטוח.
ALTER TABLE "BusinessSettings" ALTER COLUMN "pushEnabled" SET DEFAULT true;

-- Backfill: יישור השורות הקיימות לכוונה החדשה. כמעט אין בסיס בעלים אמיתי עדיין,
-- והפוש נשאר no-op עד רישום מכשיר, ולכן ההדלקה הרוחבית בטוחה ותואמת לאחור.
UPDATE "BusinessSettings" SET "pushEnabled" = true;
