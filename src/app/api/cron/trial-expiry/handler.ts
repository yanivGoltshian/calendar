import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getBusinessesForTrialExpiryNotice } from '@/server/repos/business';
import { notifyOwnerOfTrialExpiry } from '@/server/notifications/trialExpiry';

/**
 * הלוגיקה של נקודת הקצה המתוזמנת למיילי סוף-ניסיון, מופרדת מ-route.ts כדי לאפשר
 * בדיקות יחידה עם הזרקת תלויות ללא DB אמיתי.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer). מושכת
 * עסקים בחלון סוף-הניסיון, ולכל אחד שולחת (דרך notifyOwnerOfTrialExpiry, שלעולם
 * אינו זורק) מייל אזהרה או פקיעה לפי הסיווג. אידמפוטנטית ברמת התדירות: ה-cron רץ
 * פעם ביום וחלון הסבילות (±12ש׳) מבטיח פגיעה אחת לכל שכבה. כשל DB מוחזר כתשובת
 * 200 מנוונת (degraded) כדי שהמתזמן לא ייכשל על blip חולף.
 */

export type TrialExpiryDeps = {
  getBusinesses: typeof getBusinessesForTrialExpiryNotice;
  notify: typeof notifyOwnerOfTrialExpiry;
  now: () => Date;
};

export const defaultTrialExpiryDeps: TrialExpiryDeps = {
  getBusinesses: getBusinessesForTrialExpiryNotice,
  notify: notifyOwnerOfTrialExpiry,
  now: () => new Date(),
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

export async function handleTrialExpiryCron(
  req: Request,
  deps: TrialExpiryDeps = defaultTrialExpiryDeps,
): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  // תצורה חסרה בצד השרת — 500 מפורש (לא 401) כדי להבחין מכשל אימות.
  if (!expected) {
    console.error('[cron/trial-expiry] CRON_SECRET is not set — refusing to run.');
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
    const now = deps.now();
    const businesses = await deps.getBusinesses(now);
    let warned = 0;
    let expired = 0;
    let emailed = 0;
    let skipped = 0;
    let failed = 0;

    for (const b of businesses) {
      const result = await deps.notify(
        {
          businessId: b.id,
          businessName: b.name,
          ownerEmail: b.ownerEmail ?? b.owner?.email ?? null,
          ownerName: b.owner?.name ?? null,
          trialEndsAt: b.trialEndsAt,
        },
        now,
      );
      if (result.tier === 'warn') warned += 1;
      if (result.tier === 'expired') expired += 1;
      if (result.emailed) emailed += 1;
      if (result.skipped) skipped += 1;
      if (result.error) failed += 1;
    }

    console.log(
      `[cron/trial-expiry] scanned=${businesses.length} warned=${warned} expired=${expired} emailed=${emailed} skipped=${skipped} failed=${failed}`,
    );
    return NextResponse.json({
      ok: true,
      scanned: businesses.length,
      warned,
      expired,
      emailed,
      skipped,
      failed,
    });
  } catch (err) {
    // כשל DB/ריצה: מתעדים ומחזירים 200 עם גוף "מנוון" (degraded) במקום 500, כדי
    // שהמתזמן (שבודק 200) לא ייכשל על blip חולף. הקוד בגוף מאפשר אבחון בלי סודות.
    console.error('[cron/trial-expiry] unexpected error', err);
    const code = extractPrismaErrorCode(err);
    return NextResponse.json({ ok: false, degraded: true, code, scanned: 0 });
  }
}
