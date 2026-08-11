-- מיגרציה אדיטיבית בלבד: מנוי, תקופת ניסיון חינם (14 יום) ותשלום ידני לעסק.
-- שומרת על כל הנתונים הקיימים. ללא reset/drop. אינה נוגעת ב-OTP/הודעות/תזכורות.

-- CreateEnum: חבילת המנוי של העסק.
CREATE TYPE "BusinessPlan" AS ENUM ('basic', 'premium');

-- CreateEnum: מצב המנוי (מחושב על קריאה; המצב המאוחסן משמש לתצוגה בלבד).
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'expired');

-- AlterTable: הוספת עמודות אדיטיביות. plan ו-subscriptionStatus עם ברירת מחדל
-- כדי ששורות קיימות יקבלו ערך תקין מיד; שאר העמודות nullable.
ALTER TABLE "Business"
  ADD COLUMN "plan" "BusinessPlan" NOT NULL DEFAULT 'basic',
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "paidUntil" TIMESTAMP(3),
  ADD COLUMN "manualAmountAgorot" INTEGER,
  ADD COLUMN "planNotes" TEXT,
  ADD COLUMN "premiumSince" TIMESTAMP(3);

-- Backfill: תקופת ניסיון לשורות קיימות = מועד היצירה + 14 יום.
UPDATE "Business"
  SET "trialEndsAt" = "createdAt" + INTERVAL '14 days'
  WHERE "trialEndsAt" IS NULL;

-- Backfill: מצב המנוי לעסקי בסיס — trialing אם הניסיון עדיין בתוקף, אחרת expired.
UPDATE "Business"
  SET "subscriptionStatus" = CASE
    WHEN "trialEndsAt" > now() THEN 'trialing'::"SubscriptionStatus"
    ELSE 'expired'::"SubscriptionStatus"
  END
  WHERE "plan" = 'basic';

-- מקרה מיוחד: עסק התצוגה (demo-barbershop) לעולם לא נחסם מאחורי paywall.
-- מוגדר פרימיום פעיל עם תוקף תשלום ל-100 שנה קדימה.
UPDATE "Business"
  SET "plan" = 'premium'::"BusinessPlan",
      "subscriptionStatus" = 'active'::"SubscriptionStatus",
      "paidUntil" = now() + INTERVAL '100 years',
      "premiumSince" = now()
  WHERE "slug" = 'demo-barbershop';
