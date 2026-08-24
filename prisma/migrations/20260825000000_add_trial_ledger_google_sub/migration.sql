-- AlterTable
-- אנטי-ניצול: hash של מזהה גוגל היציב (OAuth sub) לזיהוי "אותו אדם עם מייל חדש".
-- אדיטיבי + nullable: כל השורות הקיימות מקבלות NULL. Postgres מתיר ריבוי NULL תחת
-- אינדקס UNIQUE, כך שאין סיכון התנגשות/גיבוי לשורות היסטוריות.
ALTER TABLE "TrialLedger" ADD COLUMN "googleSubHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrialLedger_googleSubHash_key" ON "TrialLedger"("googleSubHash");

-- CreateIndex
CREATE INDEX "TrialLedger_googleSubHash_idx" ON "TrialLedger"("googleSubHash");
