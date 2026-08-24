-- AlterTable
-- מי יזם את ביטול התור: 'CLIENT' (הלקוח מהעמוד הציבורי) או 'OWNER' (בעל העסק בניהול).
-- עמודה תוספתית ואופציונלית — אין צורך במילוי לאחור; תורים ישנים יישארו NULL.
ALTER TABLE "Appointment" ADD COLUMN "cancelledBy" TEXT;
