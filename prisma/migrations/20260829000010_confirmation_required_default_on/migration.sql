-- AlterTable
ALTER TABLE "BusinessSettings" ALTER COLUMN "confirmationRequired" SET DEFAULT true;

-- יישור חד-פעמי: עד כה קישור אישור ההגעה הוטמע בכל תזכורת ללא תלות בהגדרה, ולכן
-- ההתנהגות בפועל הייתה "דלוק". לאחר חיווט ההגדרה, מסמנים את השורות הקיימות כ-true
-- כדי לשמר את ההתנהגות הקיימת. בעל עסק שירצה תזכורת ללא בקשת אישור יכבה בהגדרות.
UPDATE "BusinessSettings" SET "confirmationRequired" = true WHERE "confirmationRequired" = false;
