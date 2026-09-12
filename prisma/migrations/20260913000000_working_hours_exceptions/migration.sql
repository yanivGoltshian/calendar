BEGIN;

DO $$ BEGIN
  CREATE TYPE "ExceptionCalendar" AS ENUM ('GREGORIAN', 'HEBREW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ExceptionRecurrence" AS ENUM ('ONCE', 'WEEKLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StaffMember_businessId_id_key" ON "StaffMember"("businessId", "id");

CREATE TABLE IF NOT EXISTS "WorkingHoursException" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "staffId" TEXT,
  "title" VARCHAR(100) NOT NULL,
  "calendar" "ExceptionCalendar" NOT NULL,
  "recurrence" "ExceptionRecurrence" NOT NULL,
  "startDate" VARCHAR(10) NOT NULL,
  "endDate" VARCHAR(10) NOT NULL,
  "until" VARCHAR(10),
  "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
  "annualMonth" VARCHAR(10),
  "annualDay" INTEGER,
  "closed" BOOLEAN NOT NULL,
  "startMinute" INTEGER,
  "endMinute" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkingHoursException_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkingHoursException_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "StaffMember"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkingHoursException_dates_check" CHECK (
    "startDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND
    "endDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND
    "startDate"::date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31' AND
    "endDate"::date BETWEEN "startDate"::date AND "startDate"::date + 365 AND
    ("until" IS NULL OR ("until" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND
      "until"::date BETWEEN "startDate"::date AND LEAST("startDate"::date + 7320, DATE '2200-12-31')))
  ),
  CONSTRAINT "WorkingHoursException_recurrence_check" CHECK (
    "intervalWeeks" BETWEEN 1 AND 52 AND
    ("recurrence" = 'WEEKLY' OR "intervalWeeks" = 1) AND
    ("recurrence" = 'ONCE' OR "endDate" = "startDate") AND
    ("recurrence" <> 'ONCE' OR "until" IS NULL) AND
    (("recurrence" = 'ANNUAL' AND "annualDay" IS NOT NULL AND "annualMonth" IS NOT NULL AND
      "annualDay" BETWEEN 1 AND 31 AND
      (("calendar" = 'GREGORIAN' AND "annualMonth" IN ('01','02','03','04','05','06','07','08','09','10','11','12')) OR
       ("calendar" = 'HEBREW' AND "annualDay" <= 30 AND "annualMonth" IN
         ('TISHRI','HESHVAN','KISLEV','TEVET','SHEVAT','ADAR','ADAR_I','ADAR_II','NISAN','IYAR','SIVAN','TAMUZ','AV','ELUL')))) OR
     ("recurrence" <> 'ANNUAL' AND "annualDay" IS NULL AND "annualMonth" IS NULL))
  ),
  CONSTRAINT "WorkingHoursException_hours_check" CHECK (
    ("closed" AND "startMinute" IS NULL AND "endMinute" IS NULL) OR
    (NOT "closed" AND "startMinute" IS NOT NULL AND "endMinute" IS NOT NULL AND
      "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
  )
);
CREATE INDEX IF NOT EXISTS "WorkingHoursException_businessId_startDate_idx" ON "WorkingHoursException"("businessId", "startDate");
CREATE INDEX IF NOT EXISTS "WorkingHoursException_recurrence_endDate_idx" ON "WorkingHoursException"("recurrence", "endDate");
COMMIT;
