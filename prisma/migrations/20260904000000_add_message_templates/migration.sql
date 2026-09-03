-- הוספת טבלת תבניות הודעות ללקוחות (MessageTemplate).
-- מאפשרת לבעל העסק לערוך את נוסח ההודעות ללקוחות הקצה (מייל/מסרון) לכל סוג הודעה
-- וערוץ. הטבלה חדשה לחלוטין וללא backfill — ללא רשומה מתאימה נשלח טקסט ברירת המחדל
-- הקיים, כך שהפלט זהה בית-לבית להתנהגות הנוכחית (תאימות לאחור מלאה).
-- subject רלוונטי למייל בלבד (NULL במסרון); body הוא טקסט פשוט עם placeholders {{var}}.
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- רשומה יחידה לכל צירוף עסק × סוג הודעה × ערוץ (upsert/מחיקה לפי מפתח זה).
CREATE UNIQUE INDEX "MessageTemplate_businessId_key_channel_key" ON "MessageTemplate"("businessId", "key", "channel");

-- אינדקס לשליפת כל תבניות העסק במסך ההגדרות.
CREATE INDEX "MessageTemplate_businessId_idx" ON "MessageTemplate"("businessId");

ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
