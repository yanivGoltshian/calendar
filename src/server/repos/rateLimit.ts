import { prisma } from '@/lib/db';
import {
  evaluateOtpRateLimit,
  getRateLimitConfig,
  type RateLimitDecision,
} from './rateLimitPolicy';

/**
 * הגבלת קצב לבקשות OTP, להגנה מפני ניצול לרעה ומפני עלויות SMS.
 *
 * שלושה מנגנונים:
 *   1. קול-דאון בין בקשות חוזרות לאותו טלפון.
 *   2. תקרה יומית לכל טלפון.
 *   3. תקרה יומית לכל כתובת IP (best-effort, בזיכרון בלבד).
 *
 * הגישה לכל טלפון מבוססת על חותמות הזמן הקיימות בטבלת otpCode (createdAt),
 * ולכן אין צורך בשינוי סכימה. הגישה לכל IP היא סינון בזיכרון התהליך
 * (best-effort): היא מתאפסת עם הפעלה מחדש ואינה משותפת בין רפליקות.
 *
 * הלוגיקה הטהורה (התצורה וההכרעה) חיה ב-rateLimitPolicy.ts ומיוצאת מחדש
 * כאן לנוחות היבוא הקיים.
 */

export {
  getRateLimitConfig,
  evaluateOtpRateLimit,
  type RateLimitConfig,
  type RateLimitReason,
  type RateLimitDecision,
  type RateLimitInput,
} from './rateLimitPolicy';

// ---------- סינון IP בזיכרון (best-effort) ----------

const ipHits = new Map<string, number[]>();

/** רישום פנייה מ-IP והחזרת מספר הפניות בחלון הנוכחי. */
function recordAndCountIp(ip: string, now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  const hits = (ipHits.get(ip) ?? []).filter((ts) => ts > cutoff);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length;
}

/** ספירת פניות מ-IP בחלון הנוכחי מבלי לרשום פנייה חדשה. */
function countIp(ip: string, now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  const hits = (ipHits.get(ip) ?? []).filter((ts) => ts > cutoff);
  ipHits.set(ip, hits);
  return hits.length;
}

/** ניקוי מצב ה-IP שבזיכרון (לצורכי בדיקה בלבד). */
export function resetIpRateLimitState(): void {
  ipHits.clear();
}

// ---------- בדיקה מלאה מול ה-DB ----------

/**
 * בדיקה האם בקשת OTP מותרת עבור טלפון ו-IP נתונים. מבצעת שאילתות קריאה
 * בלבד על otpCode (createdAt) לכל הטלפון, ומנהלת חלון IP בזיכרון. אם מותר,
 * רושמת את פניית ה-IP כדי שהתקרה תיאכף על פני בקשות עוקבות.
 */
export async function checkOtpRequestAllowed(
  phone: string,
  ip: string | null,
  env: Record<string, string | undefined> = process.env,
): Promise<RateLimitDecision> {
  const config = getRateLimitConfig(env);
  const now = Date.now();
  const windowStart = new Date(now - config.windowMs);

  const [latest, phoneCountInWindow] = await Promise.all([
    prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.otpCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    }),
  ]);

  const effectiveIp = ip && ip.length > 0 ? ip : null;
  const ipCountInWindow = effectiveIp ? countIp(effectiveIp, now, config.windowMs) : 0;

  const decision = evaluateOtpRateLimit({
    now,
    lastPhoneSentAt: latest ? latest.createdAt.getTime() : null,
    phoneCountInWindow,
    ipCountInWindow,
    config,
  });

  // רישום פניית ה-IP רק כאשר הבקשה מותרת, כדי שהתקרה תצטבר לאורך בקשות.
  if (decision.allowed && effectiveIp) {
    recordAndCountIp(effectiveIp, now, config.windowMs);
  }

  return decision;
}
