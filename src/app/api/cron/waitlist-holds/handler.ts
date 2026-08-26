import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { findExpiredHolds, expireHeldEntry } from '@/server/repos/waitlist';
import { triggerWaitlistAutofillForAppointment } from '@/server/waitlist/autofill';

/**
 * הלוגיקה של נקודת הקצה המתוזמנת לפקיעת החזקות רשימת ההמתנה (holdExpiresAt),
 * מופרדת מ-route.ts כדי לאפשר בדיקות יחידה עם הזרקת תלויות ללא DB אמיתי.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer). מוצאת
 * ממתינים שיודעו (NOTIFIED) אך לא ניצלו את המשבצת עד תום חלון ההחזקה, מסמנת אותם
 * EXPIRED (אטומי), ולאחר מכן מריצה מחדש את המילוי האוטומטי עבור אותה משבצת שהתפנתה
 * כדי להציע אותה לבא בתור. אידמפוטנטית: ריצה חוזרת ללא החזקות שפגו היא no-op.
 */

export type WaitlistHoldsDeps = {
  findExpiredHolds: typeof findExpiredHolds;
  expireHeldEntry: typeof expireHeldEntry;
  triggerWaitlistAutofillForAppointment: typeof triggerWaitlistAutofillForAppointment;
};

export const defaultWaitlistHoldsDeps: WaitlistHoldsDeps = {
  findExpiredHolds,
  expireHeldEntry,
  triggerWaitlistAutofillForAppointment,
};

function extractSecret(req: Request): string | null {
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret.trim();
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * חילוץ בטוח של קוד שגיאת Prisma לגוף התשובה בלבד — קוד קצר או שם מחלקה, לעולם
 * לא הודעת השגיאה המלאה, כתובת ה-DB או PII. מאפשר אבחון שורש הבעיה בלי לחשוף סודות.
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

export async function handleWaitlistHoldsCron(
  req: Request,
  deps: WaitlistHoldsDeps = defaultWaitlistHoldsDeps,
): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  // תצורה חסרה בצד השרת — 500 מפורש (לא 401) כדי להבחין מכשל אימות.
  if (!expected) {
    console.error('[cron/waitlist-holds] CRON_SECRET is not set — refusing to run.');
    return NextResponse.json(
      { ok: false, error: 'cron_secret_unset' },
      { status: 500 },
    );
  }

  const provided = extractSecret(req);
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const expired = await deps.findExpiredHolds(now);

    let expiredCount = 0;
    // משבצות ייחודיות שיש להריץ עליהן מחדש מילוי אוטומטי (הצעה לבא בתור).
    const appointmentIds = new Set<string>();
    for (const hold of expired) {
      const didExpire = await deps.expireHeldEntry(hold.id);
      if (didExpire) {
        expiredCount += 1;
        if (hold.heldAppointmentId) appointmentIds.add(hold.heldAppointmentId);
      }
    }

    // מציעים מחדש כל משבצת שהתפנתה — הרשומה שפגה כבר EXPIRED ולכן לא תיבחר שוב.
    let reoffered = 0;
    for (const appointmentId of appointmentIds) {
      try {
        const outcome = await deps.triggerWaitlistAutofillForAppointment(appointmentId);
        if (outcome?.offered) reoffered += 1;
      } catch (err) {
        // כשל בהצעה בודדת אינו מפיל את הסֶווֹפ כולו; הפקיעה כבר בוצעה.
        console.error('[cron/waitlist-holds] re-offer failed', err);
      }
    }

    console.log(
      `[cron/waitlist-holds] expired=${expiredCount} reoffered=${reoffered}`,
    );
    return NextResponse.json({ ok: true, expired: expiredCount, reoffered });
  } catch (err) {
    // כשל DB/ריצה: מתעדים ומחזירים 200 עם גוף "מנוון" (degraded) במקום 500, כדי
    // שהמתזמן (שבודק 200) לא ייכשל על blip חולף. הקוד בגוף מאפשר אבחון בלי סודות.
    console.error('[cron/waitlist-holds] unexpected error', err);
    const code = extractPrismaErrorCode(err);
    return NextResponse.json({ ok: false, degraded: true, code, expired: 0, reoffered: 0 });
  }
}
