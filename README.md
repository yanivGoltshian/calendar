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

ספק ההודעות ברירת המחדל הוא `console`: כאשר לקוח מבקש קוד הזדהות, הקוד **מודפס ללוג של
שרת הפיתוח** במקום להישלח ב-WhatsApp. חפשו שורה כמו `OTP for +9725… : 123456` בטרמינל.

## הקמת עסק מראש ללקוח

בסופר אדמין, הכפתור ״הקמת עסק ללקוח״ מקבל שם, תחום וטלפון או מייל של בעל העסק.
הפעולה יוצרת עסק דרך מנגנון ההקמה הקיים ומעבירה את מנהל הפלטפורמה לאותו אשף הקמה,
בלי לשלוח קוד אימות ובלי לסמן את פרטי הלקוח כמאומתים.
כניסת בעלים רגילה עם אחד הפרטים המאומתים משייכת אותו לעסק המוכן.
טלפון הקשר הציבורי של העסק אינו מעניק הרשאת בעלים.

לפני הפעלת הקוד יש להחיל את ההרחבה האדיטיבית במסלול המיגרציות הקיים:

```text
20260912000000_superadmin_provisioning
```

אין שינוי באשף ההקמה, בספקי האימות או בנתוני העסקים הקיימים.

## ייבוא נתונים בעת הקמת עסק

מנהל הפלטפורמה יכול לצרף כתובת ציבורית בעת הקמת עסק חדש. הנתונים והמדיה שנמצאו
מועברים לטיוטה ולמסך סקירה לפני השלמת ההקמה. תוכן פרטי או חסום אינו נעקף,
ונתונים חסרים ואזהרות מוצגים לבדיקה ידנית.

הייבוא דורש יצירה חדשה תחת נעילת הבעלות הקיימת. עסק שכבר הוקם או נערך נשמר ללא
החלפת נתוניו. לפני החלת הייבוא נבדקים שוב הפרופיל, השירותים, שעות העסק, הצוות
והשיוכים שנוצרו. שינוי מקביל גורם להתנגשות מפורשת ומשאיר את עריכת הבעלים.
בקשה חוזרת לאותו מקור משתמשת בייבוא שנרשם כממתין או שהושלם. כשל לאחר ההקמה
משאיר את העסק לבדיקה ולעריכה ידנית, ללא מחיקה או ניסיון חוזר אוטומטי.

## פרסום העמוד לאחר ההקמה

השלמת עורך הפרימיום שומרת בחירה מפורשת בפריסה העשירה, גם כאשר מדלגים על מקטעים.
״דלג״ מסיר את תוכן המקטע ומונע השלמה של ברירות מחדל; ״המשך״ מקבל את הערכים המוצגים.
דילוג על ״למה לבחור בנו״ נשמר גם בחזרה לעריכה. הוספת תוכן מחדש או בחירה מפורשת בדוגמאות מחזירה את המקטע; שדות ריקים נשארים ריקים.
מספר וואטסאפ שהוזן נשמר כפרט קשר עצמאי, גם כשמדלגים על מקטע הרשתות החברתיות.
מקטע ״עקבו אחרינו״ מוצג רק כשיש לפחות קישור אחד לפייסבוק, לאינסטגרם או לטיקטוק. וואטסאפ מופיע בכפתור הקשר העצמאי.
תמונה ווידאו שנשמרו בכותרת מוצגים גם בעסק קיים שטרם הגדיר לוגו.
אפשר להגדיר לוגו בעורך הפרימיום או לבחור תמונה שהועלתה לגלריה באמצעות ״הגדרה כלוגו״.
הסרת תמונה בעורך מסירה את השיוך למקטע. שינויים נכנסים לתוקף בעמוד הציבורי לאחר פרסום.

שירות שמוצג להזמנה דורש שיוך לאיש צוות פעיל. בהוספת שירות או טעינת תבניות, איש צוות פעיל יחיד משויך אוטומטית; עם כמה אנשי צוות הבחירה מפורשת.
שגיאת שיוך או כשל טעינת זמינות מוצגים בנפרד מיום ללא שעות פנויות. נתונים קיימים אינם משויכים מחדש אוטומטית.
העלאות משויכות לעסק הפעיל, כולל עבודה של מנהל הפלטפורמה באמצעות כניסה מפורשת כבעל העסק.
בתבניות ההודעות מוצגת תצוגה מקדימה עם פרטי העסק; השדות האוטומטיים נשמרים במצב העריכה.

## Working hours exceptions

Owners manage exceptions under `/admin/working-hours`, below the weekly schedule.
Choose the entire business or one active employee, a Gregorian or Hebrew starting
date, and either a full day off or alternative opening/closing times. A one-off
can cover an inclusive range of up to 366 days. Weekly rules repeat on the weekday
of their anchor date every 1–52 weeks; every other Monday uses a Monday anchor and
an interval of 2. Annual rules repeat their selected calendar month/day. Optional
recurrence end dates are inclusive Gregorian dates, at most 20 years after the
anchor. Dates are supported from 1900 through 2200; Hebrew input years are
5661–5960. Recurrence is matched against requested dates without expanding a series.

Full closures always win, including business closures over employee alternatives.
Overlapping alternative rules intersect, independently of insertion order. An
alternative replaces that scope's regular hours and breaks for the matching day.
Business alternatives replace inherited business schedules and cap employees'
personal schedules. Employee alternatives can open an otherwise absent weekly day,
subject to any business exception. With no applicable exception, existing weekly
schedule behavior is preserved.

Hebrew conversion uses the runtime's full ICU calendar support, with bounded,
round-trip validated inverse conversion and no added dependency. A Hebrew date
means its corresponding **civil day from local midnight**, rather than sunset.
Generic Adar follows the last Adar (Adar II in leap years). Explicit Adar I and
Adar II occur only in leap years. Missing annual dates, including February 29 and
30 Kislev in a short year, skip that year. Invalid input dates are rejected.

Availability and transaction-time creation/approval share the same effective
hours. Service durations and busy intervals are measured in UTC, including DST
transitions; local boundaries use the business timezone. A boundary in a DST gap
advances to the first valid minute (up to three hours); ambiguous boundaries use
the existing timezone converter's deterministic occurrence. Repeated slot labels
show the earliest available occurrence. Existing bookings, service snapshots,
reminders and histories remain unchanged when rules are added or removed.
Pending approval rechecks the hours; attendance/completion of already confirmed
appointments remains ordinary record keeping. Owners see conflicting bookings
for the next 366 days, scanning at most 1,000 appointments with an explicit
truncation notice. Conflicts require explicit customer coordination.

Dated waitlist invitations affected by exceptions check the same booking policy,
including preferred times, before claiming delivery. This scan is capped at 50
eligible employees and fails closed beyond that limit. Undated invitations retain
their existing coordination behavior. The existing manual “booked” waitlist marker
is record keeping and creates no appointment; actual bookings always pass through
the shared transaction policy.

### Combined release upgrade

The coordinated importer and hours release adds
`20260912230000_business_import_review` and
`20260913000000_working_hours_exceptions` after the 39 existing migrations.
Apply both additive migrations before activating the combined code. No rule or
import is created automatically. Existing migration files remain unchanged, and
rolling back application code can leave the nullable columns and table in place.
The isolated release gate exercises both the older audit upgrade and a separate
39-to-41 upgrade, preserves ten populated application tables and the entire prior
migration ledger, and repeats deployment with no pending changes. The migration
wrapper's `--provisioning-baseline-only` option is restricted to explicit local
test databases and is used only to construct that historical fixture.

Each tenant can store at most 200 rules. Expired one-off definitions disappear on
read and are removed on the next rule creation. The existing authenticated daily
purge scheduler can also delete up to 1,000 expired definitions per invocation by
explicitly setting `HOURS_EXCEPTION_CLEANUP_ENABLED=true` after migration and review.
This switch defaults to disabled; no new live scheduler or provider delivery is
enabled by the feature. Cleanup compares the last civil date against each business
timezone in PostgreSQL and only deletes exception definitions. Recurring rules
remain available for explicit owner deletion. Internal rule repositories require
an authorized tenant identifier; all owner actions derive it from authenticated
ownership/explicit authorized impersonation, and a composite foreign key prevents
cross-business employee references.

## סנכרון הענף הראשי לייצור

השלמת פריסה מאושרת כוללת סנכרון של הענף הראשי לקוד המדויק שפעיל בייצור:

```text
main
```

שינויים שטרם נפרסו נשארים בענפי פיתוח. לפני יישור של היסטוריות שהתפצלו שומרים
את המצב הקודם בענף גיבוי, ומשמרים את היסטוריית המיזוג ללא דחיפה כפויה.
גם לאחר חזרה לגרסה קודמת יש לסנכרן את הענף הראשי לגרסה הפעילה.

## משתני סביבה

כל המשתנים מתועדים ב-[`.env.example`](.env.example):

| משתנה | תיאור |
| --- | --- |
| `DATABASE_URL` | מחרוזת חיבור ל-PostgreSQL |
| `BUSINESS_TIMEZONE` | אזור זמן עסקי ברירת מחדל (IANA), למשל `Asia/Jerusalem` |
| `SESSION_SECRET` | מפתח לחתימת עוגיית ההתחברות (מחרוזת אקראית ארוכה) |
| `OTP_PEPPER` | "פלפל" להצפנת קודי OTP (מחרוזת אקראית ארוכה) |
| `MESSAGING_PROVIDER` | ספק ההודעות: `console` (פיתוח) או `whatsapp-cloud` (פרודקשן). תאימות לאחור ל-`SMS_PROVIDER` |
| `NEXT_PUBLIC_APP_URL` | כתובת בסיס ציבורית של האפליקציה |
| `NEXTAUTH_SECRET` | סוד לחתימת ה-JWT של כניסת הבעלים (NextAuth). חובה בפרודקשן |
| `NEXTAUTH_URL` | כתובת בסיס ל-callbacks של NextAuth, למשל `https://torchick.com` |
| `GOOGLE_CLIENT_ID` | מזהה לקוח של Google OAuth. ריק = כפתור Google מוסתר |
| `GOOGLE_CLIENT_SECRET` | סוד לקוח של Google OAuth. ריק = כפתור Google מוסתר |
| `EMAIL_SERVER` | חיבור SMTP ל-magic-link (אופציונלי, מושבת כברירת מחדל) |
| `EMAIL_FROM` | כתובת שולח ל-magic-link (אופציונלי) |

### שליחת הודעות (WhatsApp)

שכבת ההודעות תחת `src/server/providers/messaging.ts` בוחרת מתאם לפי `MESSAGING_PROVIDER` (ואם אינו מוגדר, לפי `SMS_PROVIDER` לתאימות לאחור).
בפרודקשן חובה לבחור מתאם אמיתי; אם נשאר `console` או שחסרים קרדנשלס, שליחת ה-OTP נכשלת ברעש (שגיאה בלוג והודעת i18n גנרית ללקוח) ולא מתבצעת הצלחה שקטה.

מתאם WhatsApp Cloud API של מטא (`MESSAGING_PROVIDER=whatsapp-cloud`) שולח את קוד ה-OTP דרך תבנית מסוג authentication, ותומך גם בהודעות טקסט חופשי:

| משתנה | תיאור |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | מזהה מספר הטלפון העסקי ב-Graph (חובה) |
| `WHATSAPP_ACCESS_TOKEN` | access token של WhatsApp Cloud API (סוד; חובה) |
| `WHATSAPP_OTP_TEMPLATE` | שם תבנית ה-OTP המאושרת ב-Meta (authentication; חובה) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | מזהה חשבון ה-WhatsApp Business (אופציונלי) |
| `WHATSAPP_OTP_TEMPLATE_LANG` | קוד שפת התבנית (ברירת מחדל `he`; חייב להתאים לתבנית שאושרה) |
| `WHATSAPP_OTP_BUTTON_SUBTYPE` | סוג כפתור העתקת-קוד (ברירת מחדל `url`; `none`/ריק = ללא כפתור) |
| `WHATSAPP_GRAPH_VERSION` | גרסת Graph API (ברירת מחדל `v21.0`) |
| `WHATSAPP_GRAPH_BASE_URL` | כתובת בסיס של Graph (ברירת מחדל `https://graph.facebook.com`) |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | קידומת מדינה לנרמול מספרים מקומיים (ברירת מחדל `972`) |

> מתאם SMS עתידי יכול להתחבר לאותו ממשק (`sendSms`/`sendWhatsApp`/`sendOtp`) בלי לשנות את הצרכנים; כרגע אין ערוץ SMS בתשלום, ו-`sendSms` מאציל ל-WhatsApp.

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

- **מיתוג**: האשף וההגדרות משתמשים באותו בורר פלטות. אישור המיתוג שומר מיד את כל גווני הפלטה, גם כשעוזבים לפני פרסום עמוד הפרימיום. עריכת צבע ראשי גוזרת פלטה חדשה; עדכון מיתוג שומר על יתר התוכן ועל מקטעים שהושמטו.
- **בחירת שירותים ראשונית**: שירותים שלא נבחרו נמחקים רק אם אינם משויכים לתורים, לרשימת המתנה, לכרטיסיות או למכירות. שירותים עם היסטוריה נשמרים ומוסתרים.
- **זיהוי העסק בניהול**: הלוגו מוצג בכותרת ובסמל הלשונית. כתובות הסמלים מתעדכנות עם שינוי המיתוג כדי למנוע הצגת לוגו ישן מהמטמון.
- **עדכונים וביקורות**: בהגדרות הפרופיל אפשר לערוך רצועת עדכון עד 200 תווים וקישור לביקורות בגוגל. שדה ריק מסיר את התוכן לאחר שמירה. הקישור זמין גם ללא המלצות ידניות; תוכן הביקורות והדירוג אינם מיובאים אוטומטית. המלצות שהוזנו ידנית אינן מסומנות כביקורות מאומתות מגוגל.
- **סיווג לקוחות**: הסיווג משותף לרשימת הלקוחות ולקהלי ההודעות. מזמינים לאחרונה יצרו תור במהלך 30 הימים האחרונים; חוזרים קבעו לפחות ארבעה תורים; לקוחות עבר הגיעו לפחות פעם אחת ולא יצרו תור ב־90 הימים האחרונים. תורים שבוטלו אינם נספרים. ביקור מחייב מצב הגעה או סיום במועד שכבר הגיע. קטגוריות עשויות לחפוף. לקוח פעיל הוא לקוח שאינו חסום.
- **הזמנות להתקנה**: לכל עסק נשמר מונה מקומי של שלוש הזמנות לכל היותר, עם לפחות 24 שעות בין הצגות. אפשר לדחות או להפסיק לצמיתות. התקנה מזוהה מפסיקה את ההזמנות; ניקוי נתוני הדפדפן מאפס את ההעדפה.
- **תזמון הודעות**: השליחה מתבצעת בריצה הבאה של המתזמן, שעשויה להתעכב. התהליך בודק גם כשל מדווח בגוף התשובה ומסירות שנכשלו. בקשות מקבילות מוגנות בתפיסה אטומית וביומן מסירה לנמען; מסירה עם תוצאה לא ודאית דורשת בירור לפני ניסיון נוסף.
- **ניווט בניהול**: קישורי התפריטים נטענים בלחיצה. טעינה ספקולטיבית של כל מסכי הניהול כבויה כדי למנוע עומס ותקיעות לאחר שמירה. מסנני הלקוחות טוענים מסמך מלא, בדומה לחיפוש, כדי להציג רשימה עדכנית גם במעבר מהיר בין קטגוריות.
- **שמירת טפסים בניהול**: הגדרות, שירותים, יצירת הודעות ושמירה או מחיקה של החרגות שעות משתמשים בבקשות מאומתות מאותו מקור עם תגובה עצמאית. כך השמירה אינה תלויה ברענון הזרמת המסך. ההרשאות, הוולידציה, תקרת גוף הבקשה ופסילת המטמון נשמרות. רשימות מתרעננות בניווט מלא לאחר הצלחה, ללא שליחה חוזרת אוטומטית. שגיאת אימות משאירה את כל ערכי הטיוטה בטופס.

- **שכבת נתונים** (`src/server/repos/*`) עוטפת את Prisma; הדפים והפעולות אינם ניגשים
  ל-Prisma ישירות.
- **מוטציות** דרך Server Actions ו-Route Handlers.
- **ממשקי ספקים** ל-SMS, Push ו-Payments עם מימושי פיתוח (stubs) בלבד בשלב זה.
- **כסף** נשמר כאגורות (מספר שלם), **משכים** בדקות (מספר שלם), **זמנים** ב-UTC.
