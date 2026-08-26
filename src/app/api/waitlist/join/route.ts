import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { addWaitlistEntry } from '@/server/repos/waitlist';
import { checkBookRequestAllowed } from '@/server/repos/bookRateLimit';
import { isValidIsraeliMobile } from '@/lib/crypto';
import { t } from '@/i18n';

/**
 * הצטרפות אורח לרשימת ההמתנה של עסק כשהיום מלא או המשבצת הרצויה תפוסה. ידידותי
 * לאורח (ללא התחברות/OTP): שם + נייד + חלון זמן מועדף. חלון הזמן נשמר כטווח דקות
 * מחצות (earliestMinute/latestMinute) לצורך התאמה בעת שמתפנה משבצת. מוגן בהגבלת
 * קצב מבוססת IP (משותפת עם זרימת ההזמנה) למניעת ספאם.
 */

// חלוני זמן מוגדרים מראש → טווח דקות מחצות היום. 'any' = ללא הגבלה (כל שעה).
const WINDOWS = {
  any: { earliestMinute: null, latestMinute: null },
  morning: { earliestMinute: 8 * 60, latestMinute: 12 * 60 },
  afternoon: { earliestMinute: 12 * 60, latestMinute: 16 * 60 },
  evening: { earliestMinute: 16 * 60, latestMinute: 20 * 60 },
} as const;

const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, 'name').max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => isValidIsraeliMobile(v), 'phone'),
  serviceId: z.string().trim().min(1).optional(),
  staffId: z.string().trim().min(1).optional(),
  desiredDate: z.string().trim().optional(),
  window: z.enum(['any', 'morning', 'afternoon', 'evening']).optional(),
  note: z.string().trim().max(500).optional(),
});

/** חילוץ כתובת ה-IP של הלקוח מכותרות ה-proxy (best-effort). */
function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

export async function POST(req: Request) {
  // הגבלת קצב מבוססת IP למניעת ספאם של הצטרפויות אורח.
  const ip = extractClientIp(req);
  const rateLimit = checkBookRequestAllowed(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        reason: rateLimit.reason,
        message: t.auth.tooManyRequests,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    // מיפוי שגיאת האימות לקוד קצר כדי שהלקוח יציג הודעה מתאימה (שם/נייד).
    const code =
      err && typeof err === 'object' && 'issues' in err
        ? (err as z.ZodError).issues[0]?.message
        : undefined;
    const error = code === 'name' || code === 'phone' ? code : 'bad_request';
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const business = await getBusinessBySlug(parsed.slug);
  if (!business) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const window = WINDOWS[parsed.window ?? 'any'];

  // addWaitlistEntry מאמת בעצמו ששיוך השירות/הצוות שייך לעסק (אחרת null),
  // ומנרמל את הטלפון. ידידותי לאורח — אין צורך ב-clientId.
  const { id } = await addWaitlistEntry(business.id, {
    name: parsed.name,
    phone: parsed.phone,
    serviceId: parsed.serviceId ?? null,
    staffId: parsed.staffId ?? null,
    desiredDate: parsed.desiredDate ?? null,
    earliestMinute: window.earliestMinute,
    latestMinute: window.latestMinute,
    note: parsed.note ?? null,
  });

  return NextResponse.json({ ok: true, id });
}
