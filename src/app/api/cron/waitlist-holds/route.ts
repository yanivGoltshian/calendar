import { handleWaitlistHoldsCron } from './handler';

/**
 * נקודת קצה מתוזמנת לפקיעת החזקות רשימת ההמתנה (holdExpiresAt) והצעה לבא בתור.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer). כל
 * הלוגיקה מרוכזת ב-handler.ts (עם הזרקת תלויות לצורך בדיקות יחידה); כאן נשאר רק
 * החיווט הדק של Next.js (runtime/dynamic + POST/GET). מומלץ להריץ כל 5 דקות.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleWaitlistHoldsCron(req);
}

// נתמך גם GET כדי לאפשר בדיקת smoke נוחה (מוגן באותו סוד).
export async function GET(req: Request) {
  return handleWaitlistHoldsCron(req);
}
