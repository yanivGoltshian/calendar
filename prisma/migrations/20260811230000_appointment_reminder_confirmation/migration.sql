-- מיגרציה אדיטיבית בלבד: תזכורת 24 שעות ואישור הגעה של הלקוח.
-- שומרת על כל הנתונים הקיימים (כולל העסק demo-barbershop). ללא reset/drop.

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable: הוספת עמודות. confirmToken נוסף כ-nullable תחילה כדי לאפשר מילוי
-- ערכים ייחודיים לשורות קיימות לפני אכיפת NOT NULL.
ALTER TABLE "Appointment"
  ADD COLUMN "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "confirmToken" TEXT;

-- Backfill: ערך ייחודי לכל שורה קיימת. שילוב "id" (מפתח ראשי ייחודי) בקלט ה-hash
-- מבטיח ייחודיות מוחלטת; md5 זמין ב-PostgreSQL ללא הרחבות.
UPDATE "Appointment"
  SET "confirmToken" = 'c_' || md5(random()::text || clock_timestamp()::text || "id")
  WHERE "confirmToken" IS NULL;

-- כעת כל השורות מלאות — אוכפים NOT NULL.
ALTER TABLE "Appointment" ALTER COLUMN "confirmToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmToken_key" ON "Appointment"("confirmToken");

-- CreateIndex
CREATE INDEX "Appointment_reminderSentAt_startAt_idx" ON "Appointment"("reminderSentAt", "startAt");
