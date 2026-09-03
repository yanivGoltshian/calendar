-- AlterTable: דגל כיבוי/הפעלה של רשימת ההמתנה פר-עסק (מודול רשימת ההמתנה).
-- אדיטיבי בלבד. ברירת המחדל true שומרת את ההתנהגות הקיימת — רשימת המתנה פעילה —
-- לכל העסקים הקיימים, כך שה-CTA בעמוד ההזמנה ממשיך להופיע ללא שינוי.
ALTER TABLE "BusinessSettings"
  ADD COLUMN "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true;
