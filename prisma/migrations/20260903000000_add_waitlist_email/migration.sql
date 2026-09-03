-- הוספת שדה אימייל אופציונלי לרשומת רשימת ההמתנה (WaitlistEntry).
-- ערוץ יידוע נוסף ללקוח בחבילות ללא מסרון בתשלום: כשמתפנה תור נשלח מייל "התפנה תור!"
-- (best-effort). העמודה nullable וללא backfill — תואמת לאחור ואינה משנה רשומות קיימות.
ALTER TABLE "WaitlistEntry" ADD COLUMN "email" TEXT;
