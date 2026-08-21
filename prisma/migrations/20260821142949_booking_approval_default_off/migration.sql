-- AlterTable
ALTER TABLE "BusinessSettings" ALTER COLUMN "bookingRequiresApproval" SET DEFAULT false;

-- יישור חד-פעמי: ערכי ה-true הקיימים נבעו מברירת המחדל הישנה (לא מבחירת בעל העסק),
-- ולכן מאופסים ל-false. בעל עסק שרוצה אישור תורים יפעיל אותו מחדש בהגדרות.
UPDATE "BusinessSettings" SET "bookingRequiresApproval" = false WHERE "bookingRequiresApproval" = true;
