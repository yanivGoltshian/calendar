import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  getAppointmentsDueForReminder,
  markReminderSent,
} from '@/server/repos/appointments';
import { sendReminder } from '@/server/reminders/send';
import { canSendPaidClientSms } from '@/server/subscription';

/**
 * הלוגיקה של נקודת הקצה המתוזמנת לשליחת תזכורות 24 שעות, מופרדת מ-route.ts
 * כדי לאפשר בדיקות יחידה עם הזרקת תלויות (dependency injection) ללא DB אמיתי.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer).
 * מוצאת תורים פעילים שמתחילים בחלון של כ-24 שעות קדימה (עם סבילות ±15 דק׳
 * שתואמת ל-cron כל 15 דק׳) שטרם נשלחה עבורם תזכורת, שולחת הודעה דרך שכבת
 * הספקים המשותפת ומסמנת reminderSentAt באופן אידמפוטנטי. בטוחה לריצה חוזרת.
 */

// חלון היעד: 24 שעות קדימה, עם סבילות שתואמת לתדירות ה-cron (כל 15 דק׳).
const LEAD_MS = 24 * 60 * 60 * 1000;
const TOLERANCE_MS = 15 * 60 * 1000;

// השהיה קצרה לפני ניסיון חוזר בודד על כשל חיבור חולף (חיבור קר ב-Container App).
const RETRY_DELAY_MS = 500;

// קודי שגיאה של Prisma שמעידים על כשל חיבור/מאגר חולף — שווה לנסות שוב פעם אחת.
// P2024 = timeout במאגר החיבורים, P1001 = אין גישה לשרת ה-DB,
// P1008 = timeout על פעולה, P1017 = השרת סגר את החיבור.
const TRANSIENT_DB_CODES = new Set(['P2024', 'P1001', 'P1008', 'P1017']);

/**
 * הזרקת התלויות של המטפל — מאפשרת בדיקות יחידה בלי לגעת ב-DB אמיתי.
 * ברירת המחדל (defaultReminderDeps) מחווטת למימושים האמיתיים.
 */
export type ReminderDeps = {
  getAppointmentsDueForReminder: typeof getAppointmentsDueForReminder;
  markReminderSent: typeof markReminderSent;
  sendReminder: typeof sendReminder;
};

export const defaultReminderDeps: ReminderDeps = {
  getAppointmentsDueForReminder,
  markReminderSent,
  sendReminder,
};

function extractSecret(req: Request): string | null {
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret.trim();
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

/**
 * חילוץ בטוח של קוד שגיאת Prisma לצורך דיווח בגוף התשובה. מחזיר קוד קצר בלבד
 * (למשל P2024/P1001/P2022) או שם המחלקה — לעולם לא הודעת השגיאה המלאה, כתובת
 * ה-DB, מחרוזת החיבור או כל PII. מאפשר לאבחן את שורש הבעיה בלי לחשוף סודות.
 */
export function extractPrismaErrorCode(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code;
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return err.errorCode ?? err.name;
  }
  if (err instanceof Prisma.PrismaClientRustPanicError) return err.name;
  if (err instanceof Prisma.PrismaClientUnknownRequestError) return err.name;
  if (err instanceof Prisma.PrismaClientValidationError) {
    return 'PrismaClientValidationError';
  }
  if (err instanceof Error && err.name) return err.name;
  return 'unknown';
}

/** האם מדובר בכשל חיבור/מאגר חולף שכדאי לנסות שובו פעם אחת. */
function isTransientDbError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_DB_CODES.has(err.code);
  }
  return false;
}

/** הודעה גנרית וקצרה לפי קוד — ללא כל פרט תשתית/סוד/PII. */
function safeDegradedMessage(code: string): string {
  switch (code) {
    case 'P2024':
      return 'database connection pool timeout';
    case 'P1001':
      return 'cannot reach database server';
    case 'P1008':
      return 'database operation timed out';
    case 'P1017':
      return 'database connection closed';
    case 'P2021':
    case 'P2022':
      return 'database schema mismatch';
    default:
      return 'reminder run degraded';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * שליפת התורים עם ניסיון חוזר בודד ותחום על כשל חיבור חולף בלבד, כדי שחיבור
 * "קר" ראשון לא יפיל את כל הריצה. כשל שאינו חולף (למשל סחף סכימה P2022) נזרק
 * מיד ללא המתנה — כדי שהמטפל ידווח עליו במהירות ולא יבזבז זמן על ניסיון חוזר.
 */
async function loadDueWithRetry(
  deps: ReminderDeps,
  windowStart: Date,
  windowEnd: Date,
) {
  try {
    return await deps.getAppointmentsDueForReminder(windowStart, windowEnd);
  } catch (err) {
    if (!isTransientDbError(err)) throw err;
    console.warn(
      `[cron/reminders] transient DB error on first attempt (code=${extractPrismaErrorCode(err)}); retrying once`,
    );
    await sleep(RETRY_DELAY_MS);
    return deps.getAppointmentsDueForReminder(windowStart, windowEnd);
  }
}

export async function handleReminderCron(
  req: Request,
  deps: ReminderDeps = defaultReminderDeps,
): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  // תצורה חסרה בצד השרת — מחזיר 500 מפורש (לא 401) כדי להבחין מכשל אימות.
  // זו תקלת תצורה אמיתית, לא כשל חולף, ולכן נשארת 500.
  if (!expected) {
    console.error('[cron/reminders] CRON_SECRET is not set — refusing to run.');
    return NextResponse.json(
      { ok: false, error: 'cron_secret_unset' },
      { status: 500 },
    );
  }

  const provided = extractSecret(req);
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now + LEAD_MS - TOLERANCE_MS);
  const windowEnd = new Date(now + LEAD_MS + TOLERANCE_MS);
  const window = { start: windowStart.toISOString(), end: windowEnd.toISOString() };

  const provider = process.env.SMS_PROVIDER ?? 'console';

  // המונים מוגדרים בטווח החיצוני כדי שגם כשל באמצע הלולאה (למשל markReminderSent)
  // עדיין יאפשר לדווח על ההתקדמות החלקית בגוף התשובה המנוונת (degraded).
  let found = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let alreadyMarked = 0;

  try {
    const due = await loadDueWithRetry(deps, windowStart, windowEnd);
    found = due.length;

    for (const appt of due) {
      // הערוץ והיעד נגזרים בשכבת השליחה (resolveReminderChannel) לפי העדפת העסק,
      // זהות הלקוח, והרשאת המסרון לפי החבילה. המסרון בתשלום ללקוח דלוק רק באקסקלוסיב
      // פעיל — canSendPaidClientSms מחשב זאת, וזורם כ-isExclusive לשכבת השליחה.
      const isExclusive = canSendPaidClientSms(appt.business);
      const result = await deps.sendReminder({
        id: appt.id,
        startAt: appt.startAt,
        confirmToken: appt.confirmToken,
        business: {
          id: appt.business.id,
          name: appt.business.name,
          timezone: appt.business.timezone,
          isExclusive,
          settings: appt.business.settings,
        },
        client: {
          id: appt.client.id,
          name: appt.client.name,
          phone: appt.client.phone,
          email: appt.client.email,
        },
      });

      // כשל שליחה חולף — לא מסמנים, כדי שהריצה הבאה תנסה שוב.
      if (result.status === 'failed') {
        failed += 1;
        console.error(
          `[cron/reminders] send failed appt=${appt.id} channel=${result.channel} error=${result.error}`,
        );
        continue;
      }

      // status === 'sent' או 'skipped': בשני המקרים מסמנים באופן אטומי ואידמפוטנטי.
      // 'skipped' מכסה יעד חסר, ערוץ ידני ללא כתובת, או ספק לא כשיר — מחושב ומסומן
      // אך לא נשלח בפועל (no-op-אבל-מסומן), כדי שהריצה לא תיתקע ולא תחזור על עצמה.
      const marked = await deps.markReminderSent(appt.id, new Date());
      if (marked === 0) {
        // שורה כבר סומנה במקביל — לא נספור פעמיים.
        alreadyMarked += 1;
        continue;
      }

      if (result.status === 'sent') {
        sent += 1;
      } else {
        // 'skipped': מסומן בלי שליחה בפועל — יעד חסר, ערוץ ידני ללא כתובת, או ספק
        // לא כשיר (console בפרודקשן / מייל לא מוגדר). הריצה נשארת אידמפוטנטית.
        skipped += 1;
        console.warn(
          `[cron/reminders] skipped — marked without sending appt=${appt.id} reason=${result.reason}`,
        );
      }
    }

    const counts = { found, sent, failed, skipped, alreadyMarked };
    // כאשר הספק אינו כשיר (console בפרודקשן / מייל לא מוגדר) או שאין ליעד כתובת,
    // ההודעות מחושבות ומסומנות (skipped) אך אינן נשלחות בפועל. ה-endpoint אינו קורס.
    console.log(
      `[cron/reminders] provider=${provider} window=${windowStart.toISOString()}..${windowEnd.toISOString()} ` +
        `found=${counts.found} sent=${counts.sent} failed=${counts.failed} ` +
        `skipped=${counts.skipped} alreadyMarked=${counts.alreadyMarked}`,
    );

    return NextResponse.json({
      ok: true,
      provider,
      window,
      counts,
    });
  } catch (err) {
    // כשל DB/ריצה ברמה העליונה (למשל timeout חיבור חולף, או סחף סכימה): מתעדים
    // ומחזירים 200 עם גוף "מנוון" (degraded) במקום 500. הטריגר המתוזמן בודק רק
    // סטטוס 200 ומכשיל את הריצה (ושולח מייל תקלה) על כל דבר אחר — ולכן blip חולף
    // ב-DB לא צריך להפיל את המתזמן. הקוד (code) בגוף מאפשר למפעיל לאבחן את השורש
    // (curl עם הסוד) בלי לחשוף סודות/כתובת DB/PII. שים לב: אין כאן secret/PII.
    console.error('[cron/reminders] unexpected error', err);
    const code = extractPrismaErrorCode(err);
    return NextResponse.json({
      ok: false,
      degraded: true,
      code,
      message: safeDegradedMessage(code),
      provider,
      window,
      counts: { found, sent, failed, skipped, alreadyMarked },
    });
  }
}
