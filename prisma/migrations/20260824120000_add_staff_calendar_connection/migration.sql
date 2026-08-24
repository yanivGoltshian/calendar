-- AlterTable
-- מזהה האירוע ביומן Google של בעל העסק (מודול סנכרון יומן). תוספתי ואופציונלי —
-- תורים קיימים יישארו NULL. משמש לעדכון/מחיקה של האירוע המיוצא בעת ביטול תור.
ALTER TABLE "Appointment" ADD COLUMN "googleCalendarEventId" TEXT;

-- CreateTable
CREATE TABLE "StaffCalendarConnection" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "googleEmail" TEXT,
    "importBusy" BOOLEAN NOT NULL DEFAULT true,
    "exportBookings" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffCalendarConnection_staffId_key" ON "StaffCalendarConnection"("staffId");

-- CreateIndex
CREATE INDEX "StaffCalendarConnection_businessId_idx" ON "StaffCalendarConnection"("businessId");

-- AddForeignKey
ALTER TABLE "StaffCalendarConnection" ADD CONSTRAINT "StaffCalendarConnection_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
