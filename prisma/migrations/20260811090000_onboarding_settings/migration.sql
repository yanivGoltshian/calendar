-- מודול הקמה והגדרות: הרחבה אדיטיבית של BusinessSettings בלבד.
-- מתגי שקיפות, טקסטים מותאמים, תצורת תזכורות/אישורים ודגל אונבורדינג.
-- כל השדות עם ברירת מחדל או Nullable — תואם לאחור, ללא נגיעה במודולים אחרים.

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "confirmationMessage" TEXT,
ADD COLUMN     "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderChannel" "ReminderChannel" NOT NULL DEFAULT 'SMS',
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showDurationPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showPricesPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showStaffPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcomeMessage" TEXT;
