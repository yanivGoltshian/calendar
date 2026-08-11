import {
  evaluateOtpRateLimit,
  type RateLimitConfig,
  type RateLimitDecision,
} from './rateLimitPolicy';

/**
 * הגבלת קצב לבקשות קביעת תור (guest booking), להגנה מפני ספאם.
 *
 * מכיוון שקביעת התור אינה דורשת עוד OTP, אין חסם טבעי מפני הצפה. כאן מוסיפים
 * הגבלה מבוססת IP בלבד (best-effort, בזיכרון התהליך): קול-דאון קצר בין בקשות
 * חוזרות מאותו IP, ותקרה שעתית לכל IP.
 *
 * הלוגיקה הטהורה של ההכרעה משותפת עם מסלול ה-OTP (evaluateOtpRateLimit),
 * ולכן זהו מתאם דק ולא מנוע חדש. שדה phoneCountInWindow משמש כאן כמונה
 * הבקשות לאותו IP, ו-ipCountInWindow אינו בשימוש (0).
 */

export const HOUR_MS = 60 * 60 * 1000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * תצורת הגבלת הקצב לקביעת תור, עם ברירות מחדל בטוחות. ניתן לדריסה דרך:
 *   BOOK_COOLDOWN_SECONDS     (ברירת מחדל 5)
 *   BOOK_MAX_PER_IP_PER_HOUR  (ברירת מחדל 20)
 */
export function getBookRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  return {
    cooldownSeconds: parsePositiveInt(env.BOOK_COOLDOWN_SECONDS, 5),
    phoneDailyCap: parsePositiveInt(env.BOOK_MAX_PER_IP_PER_HOUR, 20),
    ipDailyCap: Number.MAX_SAFE_INTEGER,
    windowMs: HOUR_MS,
  };
}

// ---------- סינון IP בזיכרון (best-effort) ----------

const ipHits = new Map<string, number[]>();

/** ניקוי מצב ה-IP שבזיכרון (לצורכי בדיקה בלבד). */
export function resetBookRateLimitState(): void {
  ipHits.clear();
}

/**
 * בדיקה האם בקשת קביעת תור מותרת עבור IP נתון. מנהלת חלון בזיכרון בלבד.
 * אם מותר, רושמת את הפנייה כדי שהתקרה תיאכף על פני בקשות עוקבות. כאשר אין IP
 * זמין (best-effort), הבקשה מותרת מבלי להירשם.
 */
export function checkBookRequestAllowed(
  ip: string | null,
  env: Record<string, string | undefined> = process.env,
): RateLimitDecision {
  const effectiveIp = ip && ip.length > 0 ? ip : null;
  if (!effectiveIp) return { allowed: true };

  const config = getBookRateLimitConfig(env);
  const now = Date.now();
  const cutoff = now - config.windowMs;
  const hits = (ipHits.get(effectiveIp) ?? []).filter((ts) => ts > cutoff);
  const lastHit = hits.length > 0 ? hits[hits.length - 1] : null;

  const decision = evaluateOtpRateLimit({
    now,
    lastPhoneSentAt: lastHit,
    phoneCountInWindow: hits.length,
    ipCountInWindow: 0,
    config,
  });

  // רישום הפנייה רק כאשר הבקשה מותרת, כדי שהתקרה תצטבר לאורך בקשות.
  if (decision.allowed) {
    hits.push(now);
    ipHits.set(effectiveIp, hits);
  } else {
    // שמירת החלון המנוקה גם בדחייה, למניעת גדילת זיכרון.
    ipHits.set(effectiveIp, hits);
  }

  return decision;
}
