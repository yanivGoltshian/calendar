import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { purgeExpiredBusinesses } from '@/server/repos/business';

/**
 * הלוגיקה של נקודת הקצה המתוזמנת למחיקה סופית (purge) של מנויים שהגיע מועד המחיקה
 * שלהם, מופרדת מ-route.ts כדי לאפשר בדיקות יחידה עם הזרקת תלויות ללא DB אמיתי.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer). מוצאת
 * עסקים ב-PENDING_DELETION שמועד ה-purge שלהם עבר, ומוחקת לצמיתות את כל נתוני
 * העסק והלקוחות בטרנזקציה בטוחה (ראו purgeExpiredBusinesses). אידמפוטנטית: ריצה
 * חוזרת אחרי שאין עסקים בשלים היא no-op.
 */

export type PurgeDeps = {
  purgeExpiredBusinesses: typeof purgeExpiredBusinesses;
};

export const defaultPurgeDeps: PurgeDeps = {
  purgeExpiredBusinesses,
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

export async function handlePurgeCron(
  req: Request,
  deps: PurgeDeps = defaultPurgeDeps,
): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  // תצורה חסרה בצד השרת — 500 מפורש (לא 401) כדי להבחין מכשל אימות.
  if (!expected) {
    console.error('[cron/purge-expired] CRON_SECRET is not set — refusing to run.');
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
    const { purgedBusinessIds } = await deps.purgeExpiredBusinesses(new Date());
    console.log(`[cron/purge-expired] purged=${purgedBusinessIds.length}`);
    return NextResponse.json({ ok: true, purged: purgedBusinessIds.length });
  } catch (err) {
    // כשל DB/ריצה: מתעדים ומחזירים 200 עם גוף "מנוון" (degraded) במקום 500, כדי
    // שהמתזמן (שבודק 200) לא ייכשל על blip חולף. הקוד בגוף מאפשר אבחון בלי סודות.
    console.error('[cron/purge-expired] unexpected error', err);
    const code = extractPrismaErrorCode(err);
    return NextResponse.json({ ok: false, degraded: true, code, purged: 0 });
  }
}
