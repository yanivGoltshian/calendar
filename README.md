# תור צ׳יק (Torchick) — פלטפורמת קביעת תורים וניהול עסק

מערכת SaaS לעסקי שירות בישראל (מספרות, קוסמטיקה, ציפורניים, מאמנים אישיים, טיפוח כלבים
ועוד). הממשק כולו בעברית ומימין לשמאל (RTL). זהו שלד אבן דרך 1 (Milestone 1).

## מה כלול בשלד הזה

- **עמוד עסק ציבורי** (`/b/<slug>`) — פרטי העסק, רשימת שירותים וקריאה לפעולה "קבעו תור".
- **זרימת הזמנה** (`/b/<slug>/book`) — בורר רב-שלבי: שירותים ← איש צוות ← תאריך ← שעה ←
  סיכום ← אישור, עם חישוב שעות פנויות אמיתי משעות העבודה פחות תורים קיימים.
- **הזדהות לקוח ב-OTP** — בקשת קוד ואימות. בפיתוח הקוד מודפס ללוג הקונסולה בלבד.
- **יומן ניהולי** (`/admin`) — תצוגת יום לפי איש צוות, עם יצירה ידנית, אישור הגעה וביטול.
- **נתוני דמו** — עסק, שני אנשי צוות, שירותים, שעות עבודה ותורים לדוגמה.

היקף מלא ואבני דרך הבאות: ראו [`docs/mvp.md`](docs/mvp.md).

## מחסנית טכנולוגית

Next.js (App Router) · TypeScript · Tailwind CSS (RTL) · Prisma ORM · PostgreSQL · PWA.

## דרישות מקדימות

- Node.js 20 ומעלה
- PostgreSQL פעיל (מקומי או מרוחק)

## התקנה והרצה

```bash
# 1. התקנת תלויות
npm install

# 2. הגדרת משתני סביבה — העתיקו את הדוגמה ועדכנו את DATABASE_URL
cp .env.example .env

# 3. יצירת סכימת מסד הנתונים (מיגרציות)
npm run prisma:migrate

# 4. אכלוס נתוני דמו
npm run db:seed

# 5. הרצת שרת הפיתוח
npm run dev
```

לאחר מכן פתחו את הכתובות הבאות:

- עמוד העסק הציבורי: <http://localhost:3000/b/demo-barbershop>
- זרימת ההזמנה: <http://localhost:3000/b/demo-barbershop/book>
- היומן הניהולי: <http://localhost:3000/admin>

### קוד ה-OTP בפיתוח

ספק ה-SMS ברירת המחדל הוא `console`: כאשר לקוח מבקש קוד הזדהות, הקוד **מודפס ללוג של
שרת הפיתוח** במקום להישלח ב-SMS. חפשו שורה כמו `OTP for +9725… : 123456` בטרמינל.

## משתני סביבה

כל המשתנים מתועדים ב-[`.env.example`](.env.example):

| משתנה | תיאור |
| --- | --- |
| `DATABASE_URL` | מחרוזת חיבור ל-PostgreSQL |
| `BUSINESS_TIMEZONE` | אזור זמן עסקי ברירת מחדל (IANA), למשל `Asia/Jerusalem` |
| `SESSION_SECRET` | מפתח לחתימת עוגיית ההתחברות (מחרוזת אקראית ארוכה) |
| `OTP_PEPPER` | "פלפל" להצפנת קודי OTP (מחרוזת אקראית ארוכה) |
| `SMS_PROVIDER` | ספק ההודעות: `console` (פיתוח), `twilio`, או `httpgateway` |
| `NEXT_PUBLIC_APP_URL` | כתובת בסיס ציבורית של האפליקציה |

### שליחת הודעות (SMS ו-WhatsApp)

שכבת ההודעות תחת `src/server/providers/messaging.ts` בוחרת מתאם לפי `SMS_PROVIDER`.
בפרודקשן חובה לבחור מתאם אמיתי; אם נשאר `console` או שחסרים קרדנשלס, שליחת ה-OTP נכשלת ברעש (שגיאה בלוג והודעת i18n גנרית ללקוח) ולא מתבצעת הצלחה שקטה.

מתאם Twilio (`SMS_PROVIDER=twilio`) שולח SMS וגם WhatsApp:

| משתנה | תיאור |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | מזהה חשבון Twilio (סוד) |
| `TWILIO_AUTH_TOKEN` | טוקן אימות Twilio (סוד) |
| `TWILIO_MESSAGING_SERVICE_SID` | מזהה Messaging Service (או להשתמש ב-`TWILIO_FROM`) |
| `TWILIO_FROM` | מספר שולח ל-SMS (אם אין Messaging Service) |
| `TWILIO_WHATSAPP_FROM` | מספר שולח ל-WhatsApp (נופל חזרה ל-`TWILIO_FROM`) |

מתאם שער ישראלי גנרי מבוסס HTTP (`SMS_PROVIDER=httpgateway`):

| משתנה | תיאור |
| --- | --- |
| `SMS_GATEWAY_PRESET` | preset מוכן: `019` או `inforu` (קובע endpoint ו-payload) |
| `SMS_GATEWAY_ENDPOINT` | כתובת ה-endpoint (דורש אם אין preset) |
| `SMS_GATEWAY_METHOD` | שיטת HTTP (ברירת מחדל `POST`) |
| `SMS_GATEWAY_AUTH_MODE` | מצב אימות: `bearer`, `basic`, `header`, `none` |
| `SMS_GATEWAY_TOKEN` | טוקן אימות (סוד; ל-`bearer`/`header`) |
| `SMS_GATEWAY_USERNAME` | שם משתמש (סוד; ל-`basic`) |
| `SMS_GATEWAY_PASSWORD` | סיסמה (סוד; ל-`basic`) |
| `SMS_GATEWAY_AUTH_HEADER` | שם כותרת אימות מותאם (ל-`header`) |
| `SMS_GATEWAY_FROM` | מזהה/שם השולח |
| `SMS_GATEWAY_TO_FIELD` | שם שדה היעד ב-payload (ברירת מחדל `to`) |
| `SMS_GATEWAY_TEXT_FIELD` | שם שדה הטקסט ב-payload (ברירת מחדל `text`) |
| `SMS_GATEWAY_FROM_FIELD` | שם שדה השולח ב-payload (ברירת מחדל `from`) |
| `SMS_GATEWAY_EXTRA_JSON` | JSON נוסף שממוזג ל-payload (מחרוזת JSON) |

הגבלת קצב של בקשות OTP (הגנה מפני ניצול לרעה ועלויות):

| משתנה | תיאור |
| --- | --- |
| `OTP_COOLDOWN_SECONDS` | קול-דאון בין שליחות חוזרות לאותו טלפון (ברירת מחדל 60) |
| `OTP_MAX_PER_PHONE_PER_DAY` | תקרת בקשות ליום לכל טלפון (ברירת מחדל 8) |
| `OTP_MAX_PER_IP_PER_DAY` | תקרת בקשות ליום לכל IP (ברירת מחדל 30) |

## סקריפטים שימושיים

| פקודה | פעולה |
| --- | --- |
| `npm run dev` | שרת פיתוח |
| `npm run build` | בנייה לייצור (כולל `prisma generate`) |
| `npm run start` | הרצת בניית הייצור |
| `npm run typecheck` | בדיקת טיפוסים (`tsc --noEmit`) |
| `npm run lint` | בדיקת ESLint |
| `npm run format` | עיצוב קוד עם Prettier |
| `npm run prisma:migrate` | הרצת מיגרציות פיתוח |
| `npm run db:seed` | אכלוס נתוני דמו |
| `npm run db:reset` | איפוס המסד והרצת מיגרציות מחדש |
| `npm run gen:icons` | יצירת אייקוני ה-PWA |

## מבנה הפרויקט

```
prisma/            סכימת Prisma, מיגרציות וסקריפט seed
public/            נכסים סטטיים, אייקוני PWA ו-service worker
scripts/           כלי עזר (מחולל אייקונים)
src/
  app/             דפי App Router (עמוד ציבורי, הזמנה, admin, API)
  config/          brand.ts — ריכוז שם המותג
  i18n/            מחרוזות עברית
  lib/             עזרי זמן, כסף, הצפנה, סשן, חיבור DB
  server/
    providers/     ממשקי SMS / Push / Payments עם מימושי dev
    repos/         שכבת גישה לנתונים העוטפת את Prisma
```

## ארכיטקטורה

- **שכבת נתונים** (`src/server/repos/*`) עוטפת את Prisma; הדפים והפעולות אינם ניגשים
  ל-Prisma ישירות.
- **מוטציות** דרך Server Actions ו-Route Handlers.
- **ממשקי ספקים** ל-SMS, Push ו-Payments עם מימושי פיתוח (stubs) בלבד בשלב זה.
- **כסף** נשמר כאגורות (מספר שלם), **משכים** בדקות (מספר שלם), **זמנים** ב-UTC.
