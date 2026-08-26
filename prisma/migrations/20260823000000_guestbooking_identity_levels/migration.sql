-- משפך "אורח תחילה": רמות זהות ללקוח + מתגי מדיניות זהות לעסק.
-- אדיטיבי ותואם לאחור: כל השדות עם ברירת מחדל, לא נדרש backfill ידני מעבר לעדכון NONE למטה.

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'NONE');

-- AlterTable: רמת אימות הזהות של הלקוח. ברירת מחדל UNVERIFIED לרשומות קיימות (יש טלפון, לא עברו OTP).
ALTER TABLE "Client" ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- Backfill: לקוחות ללא טלפון מסומנים NONE ("ללא טלפון").
UPDATE "Client" SET "verificationStatus" = 'NONE' WHERE "phone" IS NULL;

-- AlterTable: מתגי מדיניות זהות במשפך ההזמנה (ברירת מחדל: חיכוך מינימלי).
ALTER TABLE "BusinessSettings" ADD COLUMN "requirePhoneVerification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessSettings" ADD COLUMN "allowBookingWithoutPhone" BOOLEAN NOT NULL DEFAULT false;
