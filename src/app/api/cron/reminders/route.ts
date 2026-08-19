import { NextResponse } from 'next/server';
import {
  getAppointmentsDueForReminder,
  markReminderSent,
} from '@/server/repos/appointments';
import { sendReminder } from '@/server/reminders/send';

/**
 * נקודת קצה מתוזמנת לשליחת תזכורות 24 שעות.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer).
 * מוצאת תורים פעילים שמתחילים בחלון של כ-24 שעות קדימה (עם סבילות ±15 דק׳
 * שתואמת ל-cron כל 15 דק׳) שטרם נשלחה עבורם תזכורת, שולחת הודעה דרך שכבת
 * הספקים המשותפת ומסמנת reminderSentAt באופן אידמפוטנטי. בטוחה לריצה חוזרת.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// חלון היעד: 24 שעות קדימה, עם סבילות שתואמת לתדירות ה-cron (כל 15 דק׳).
const LEAD_MS = 24 * 60 * 60 * 1000;
const TOLERANCE_MS = 15 * 60 * 1000;

function extractSecret(req: Request): string | null {
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret.trim();
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET;
  // תצורה חסרה בצד השרת — מחזיר 500 מפורש (לא 401) כדי להבחין מכשל אימות.
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

  const provider = process.env.SMS_PROVIDER ?? 'console';

  try {
    const due = await getAppointmentsDueForReminder(windowStart, windowEnd);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let alreadyMarked = 0;

    for (const appt of due) {
      // הערוץ והיעד נגזרים בשכבת השליחה (resolveReminderChannel) לפי העדפת העסק
      // וזהות הלקוח; אין עוד שער טלפון מקדים כאן, כדי שגם לקוח עם מייל בלבד יטופל.
      const result = await sendReminder({
        id: appt.id,
        startAt: appt.startAt,
        confirmToken: appt.confirmToken,
        business: {
          name: appt.business.name,
          timezone: appt.business.timezone,
          reminderChannel: appt.business.reminderChannel,
        },
        client: {
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
      const marked = await markReminderSent(appt.id, new Date());
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

    const counts = {
      found: due.length,
      sent,
      failed,
      skipped,
      alreadyMarked,
    };
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
      window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
      counts,
    });
  } catch (err) {
    // לעולם לא מפילים את ה-endpoint — רושמים ומחזירים 500 מובנה.
    console.error('[cron/reminders] unexpected error', err);
    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}

// נתמך גם GET כדי לאפשר בדיקת smoke נוחה (מוגן באותו סוד).
export async function GET(req: Request) {
  return handle(req);
}
