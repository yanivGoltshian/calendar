import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { canAcceptPublicBookings } from '@/server/subscription';
import { checkBookRequestAllowed } from '@/server/repos/bookRateLimit';
import { addWaitlistEntry } from '@/server/repos/waitlist';
import { notifyOwnerOfWaitlist } from '@/server/notifications/ownerWaitlist';
import { isValidIsraeliMobile } from '@/lib/crypto';
import { absoluteUrl } from '@/lib/seo';
import { t } from '@/i18n';

/**
 * הצטרפות אורח לרשימת ההמתנה מעמוד ההזמנה הציבורי.
 *
 * מופעל מרכיב ה-CTA ברמת-היום כאשר אין מועדים פנויים ליום מסוים. משקף את מוסכמות
 * נתיב ההזמנה הציבורי (/api/book): הגבלת קצב מבוססת IP, ולידציה עם zod, שליפת העסק,
 * ואכיפת מנוי בצד השרת. רשומת ההמתנה נשמרת דרך ה-repo הקיים (עדיפות לפי סדר הרשמה,
 * createdAt עולה), ולאחר מכן נשלחת התראה מיטבית לבעל העסק — שאינה חוסמת את ההצטרפות.
 */

const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().optional(),
  serviceId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  desiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'desiredDate must be YYYY-MM-DD')
    .optional(),
  earliestMinute: z.number().int().min(0).max(1439).optional(),
  latestMinute: z.number().int().min(0).max(1439).optional(),
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
  // הגבלת קצב מבוססת IP למניעת ספאם של הצטרפויות (משותפת עם נתיב ההזמנה).
  const ip = extractClientIp(req);
  const rateLimit = checkBookRequestAllowed(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', reason: rateLimit.reason, message: t.auth.tooManyRequests },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // ולידציית טלפון נייד ישראלי — עקבי עם טופס ההוספה בניהול וטופס ההזמנה.
  if (!isValidIsraeliMobile(parsed.phone)) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  // חלון זמן: אם ניתנו שני קצוות ולא תקינים (התחלה אחרי סוף) — נתעלם מהחלון בחן.
  let earliestMinute = parsed.earliestMinute ?? null;
  let latestMinute = parsed.latestMinute ?? null;
  if (earliestMinute != null && latestMinute != null && earliestMinute > latestMinute) {
    earliestMinute = null;
    latestMinute = null;
  }

  const business = await getBusinessBySlug(parsed.slug);
  if (!business) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // אכיפת מנוי בצד השרת: עסק שאינו פעיל אינו מקבל הצטרפויות דרך העמוד הציבורי.
  if (!canAcceptPublicBookings(business)) {
    return NextResponse.json({ ok: false, error: 'business_inactive' }, { status: 403 });
  }

  const result = await addWaitlistEntry(business.id, {
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email ?? null,
    serviceId: parsed.serviceId ?? null,
    staffId: parsed.staffId ?? null,
    desiredDate: parsed.desiredDate ?? null,
    earliestMinute,
    latestMinute,
    note: parsed.note ?? null,
  });

  // התראת בעל העסק — מיטבית, לעולם אינה חוסמת או מפילה את ההצטרפות.
  try {
    const serviceName = parsed.serviceId
      ? business.services.find((s) => s.id === parsed.serviceId)?.name ?? null
      : null;
    await notifyOwnerOfWaitlist({
      entryId: result.id,
      businessName: business.name,
      ownerEmail: business.ownerEmail,
      ownerUserEmail: business.owner?.email ?? null,
      clientName: parsed.name,
      clientPhone: parsed.phone,
      serviceName,
      desiredDate: parsed.desiredDate ?? null,
      earliestMinute,
      latestMinute,
      timezone: business.timezone,
      waitlistUrl: absoluteUrl('/admin/waitlist'),
    });
  } catch {
    // כבר טופל בתוך notifyOwnerOfWaitlist (לעולם אינו זורק) — שכבת הגנה נוספת.
  }

  return NextResponse.json({ ok: true, entryId: result.id });
}
