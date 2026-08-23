import { handleTrialExpiryCron } from './handler';

/**
 * נקודת קצה מתוזמנת למיילי סוף-ניסיון (אזהרה ~3 ימים לפני, פקיעה ביום עצמו).
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer).
 * כל הלוגיקה מרוכזת ב-handler.ts (עם הזרקת תלויות לצורך בדיקות יחידה); כאן נשאר
 * רק החיווט הדק של Next.js (runtime/dynamic + POST/GET).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleTrialExpiryCron(req);
}

// נתמך גם GET כדי לאפשר בדיקת smoke נוחה (מוגן באותו סוד).
export async function GET(req: Request) {
  return handleTrialExpiryCron(req);
}
