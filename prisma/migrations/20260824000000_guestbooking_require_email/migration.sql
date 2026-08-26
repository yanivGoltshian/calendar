-- משפך "אורח תחילה": מתג "דרוש מייל" לעסק, בשליטת הבעלים ומנותק מהמסלול (basic/premium).
-- אדיטיבי ותואם לאחור: עמודה עם ברירת מחדל true, ולכן רשומות קיימות יורשות את ההמלצה
-- (טלפון + מייל) ללא צורך ב-backfill ידני.

-- AlterTable: דרישת מייל בקביעת תור. ברירת מחדל true (המלצה: טלפון + מייל; המייל גם חיבור גוגל).
ALTER TABLE "BusinessSettings" ADD COLUMN "requireEmail" BOOLEAN NOT NULL DEFAULT true;
