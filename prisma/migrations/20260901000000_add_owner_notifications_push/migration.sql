-- AlterTable: מתגי התראות לבעל העסק (מודול תיקון באג 11). ברירות המחדל נבחרו
-- לשימור ההתנהגות הקיימת: התראות הזמנה/ביטול דלוקות, פוש כבוי עד הצטרפות מפורשת.
ALTER TABLE "BusinessSettings"
  ADD COLUMN "notifyOnBooking" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyOnCancellation" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: מנויי Web Push של דפדפן בעל העסק.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_businessId_idx" ON "PushSubscription"("businessId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
