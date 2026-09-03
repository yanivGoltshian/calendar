-- AlterTable: דגל תצוגה ציבורית מאוחד פר-עסק (רשימה /businesses + מפת אתר + אינדוקס).
-- אדיטיבי בלבד. ברירת המחדל true שומרת את ההתנהגות הקיימת לכל העסקים, כך שאף עמוד
-- עסק קיים לא נעלם מהאינדוקס או מהמפה בעקבות המיגרציה עצמה.
ALTER TABLE "Business"
  ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT true;

-- מילוי לאחור (backfill) מכוון: עסקי דמו/בדיקה מוסתרים מהאינדוקס והרשימה, והעסק
-- האמיתי skin-beauty נשאר גלוי. השאר נותרים על ברירת המחדל true.
UPDATE "Business" SET "listed" = false WHERE "slug" IN ('demo-barbershop', 'esek', 'esek-2');
UPDATE "Business" SET "listed" = true  WHERE "slug" = 'skin-beauty';
