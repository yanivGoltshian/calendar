import { handlePurgeCron } from './handler';

/**
 * נקודת קצה מתוזמנת למחיקה סופית (purge) של מנויים שהגיע מועד המחיקה שלהם.
 *
 * מוגנת בסוד CRON_SECRET (כותרת x-cron-secret או Authorization: Bearer). כל
 * הלוגיקה מרוכזת ב-handler.ts (עם הזרקת תלויות לצורך בדיקות יחידה); כאן נשאר רק
 * החיווט הדק של Next.js (runtime/dynamic + POST/GET).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handlePurgeCron(req);
}

// נתמך גם GET כדי לאפשר בדיקת smoke נוחה (מוגן באותו סוד).
export async function GET(req: Request) {
  return handlePurgeCron(req);
}
