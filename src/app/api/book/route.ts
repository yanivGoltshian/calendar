import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { getServicesByIds } from '@/server/repos/services';
import {
  createAppointment,
  hasConflict,
} from '@/server/repos/appointments';
import { findOrCreateClient } from '@/server/repos/clients';
import { createReminder } from '@/server/repos/reminders';
import { notifyOwnerOfBooking } from '@/server/notifications/ownerBooking';
import { absoluteUrl } from '@/lib/seo';
import { getClientSession } from '@/lib/session';
import { resolveGuestIdentity } from '@/server/booking/guestIdentity';
import { checkBookRequestAllowed } from '@/server/repos/bookRateLimit';
import { t } from '@/i18n';

const bodySchema = z.object({
  slug: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  startAtUtc: z.string().datetime(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
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
  // קביעת תור אינה דורשת עוד OTP: אם קיימת התחברות לקוח נשתמש בה (תאימות
  // לאחור), אחרת נקבל הזמנת אורח לפי שם + טלפון. אישור העסק (PENDING) עדיין
  // חוסם את התור, ולכן זה בטוח ל-MVP.
  const session = await getClientSession();

  // הגבלת קצב מבוססת IP למניעת ספאם של הזמנות אורח.
  const ip = extractClientIp(req);
  const rateLimit = checkBookRequestAllowed(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', reason: rateLimit.reason, message: t.auth.tooManyRequests },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // שליפת העסק מוקדם: נדרשת גם לאכיפת מדיניות פרטי הקשר לפי מסלול (סטנדרט/פרימיום).
  const business = await getBusinessBySlug(parsed.slug);
  if (!business) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // מדיניות פרטי קשר לפי מסלול: סטנדרט מחייב גם טלפון וגם מייל (בעל העסק מקבל תמיד
  // טלפון, והמייל חינמי עד 500 ליום); פרימיום מתיר טלפון בלבד כהטבה.
  const requireBothContacts = business.plan !== 'premium';

  // מדיניות זהות במשפך "אורח תחילה" (ברירת מחדל: חיכוך מינימלי, שני המתגים כבויים).
  const allowNoPhone = business.settings?.allowBookingWithoutPhone ?? false;
  const requireVerification = business.settings?.requirePhoneVerification ?? false;

  // זהות הלקוח: מתוך ההתחברות אם קיימת (טלפון ו/או מייל), אחרת מפרטי הזמנת האורח.
  let clientPhone: string | undefined;
  let clientEmail: string | undefined;
  let clientName: string;
  let clientUserId: string | undefined;
  // רמת אימות הזהות שתירשם על הלקוח: מחובר/OTP → VERIFIED; אורח → UNVERIFIED/NONE.
  let clientVerification: 'VERIFIED' | 'UNVERIFIED' | 'NONE';
  if (session) {
    clientPhone = session.phone;
    clientEmail = session.email;
    clientName = parsed.name ?? session.name ?? session.phone ?? session.email ?? 'לקוח';
    clientUserId = session.userId;
    // התחברות לקוח מתבצעת דרך OTP/Firebase, ולכן היא נחשבת זהות מאומתת.
    clientVerification = 'VERIFIED';
  } else {
    // חוקת זהות אורח חולצה לפונקציה טהורה `resolveGuestIdentity` (משותפת עם המבחן).
    const guest = resolveGuestIdentity(parsed.name, parsed.phone, parsed.email, {
      requireBoth: requireBothContacts,
      allowNoContact: allowNoPhone,
    });
    if (!guest.ok) {
      return NextResponse.json({ ok: false, error: guest.error }, { status: 400 });
    }
    clientPhone = guest.phone;
    clientEmail = guest.email;
    clientName = guest.name;
    clientUserId = undefined;
    clientVerification = guest.verificationStatus; // UNVERIFIED (יש טלפון) או NONE (ללא טלפון)

    // כשהעסק דורש אימות טלפון, מסלול האורח (ללא OTP) חסום — יש להתחבר תחילה.
    if (requireVerification) {
      return NextResponse.json({ ok: false, error: 'verification_required' }, { status: 400 });
    }
  }

  // אימות שאיש הצוות שייך לעסק ופעיל.
  const staff = business.staff.find((m) => m.id === parsed.staffId);
  if (!staff) {
    return NextResponse.json({ ok: false, error: 'invalid_staff' }, { status: 400 });
  }

  // טעינת השירותים (חייבים להשתייך לעסק).
  const services = await getServicesByIds(business.id, parsed.serviceIds);
  if (services.length !== parsed.serviceIds.length) {
    return NextResponse.json({ ok: false, error: 'invalid_service' }, { status: 400 });
  }

  const startAt = new Date(parsed.startAtUtc);
  if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: 'invalid_time' }, { status: 400 });
  }

  // אכיפת מדיניות ההזמנות של העסק (עם ברירות מחדל תואמות ל-BusinessSettings).
  const settings = business.settings;
  const minLeadMinutes = settings?.minLeadTimeMinutes ?? 120;
  const maxAdvanceDays = settings?.maxAdvanceBookingDays ?? 60;
  const requiresApproval = settings?.bookingRequiresApproval ?? false;
  const reminderLeadHours = settings?.reminderLeadHours ?? 24;

  const now = Date.now();
  if (startAt.getTime() < now + minLeadMinutes * 60_000) {
    return NextResponse.json({ ok: false, error: 'too_early' }, { status: 400 });
  }
  if (startAt.getTime() > now + maxAdvanceDays * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: 'too_far' }, { status: 400 });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.priceAgorot, 0);
  const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

  // בדיקת התנגשות אחרונה לפני יצירה (מונע קביעה כפולה על אותה משבצת).
  if (await hasConflict(parsed.staffId, startAt, endAt)) {
    return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 });
  }

  // יצירה/איתור לקוח לפי טלפון (מהתחברות או מהזמנת אורח).
  const client = await findOrCreateClient({
    businessId: business.id,
    phone: clientPhone,
    email: clientEmail,
    name: clientName,
    userId: clientUserId,
    verificationStatus: clientVerification,
  });

  // סטטוס התחלתי לפי מדיניות: PENDING כשנדרש אישור עסק, אחרת CONFIRMED.
  const status = requiresApproval ? 'PENDING' : 'CONFIRMED';

  const appointment = await createAppointment({
    businessId: business.id,
    clientId: client.id,
    staffId: parsed.staffId,
    startAt,
    endAt,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      priceAgorot: s.priceAgorot,
    })),
    totalPriceAgorot: totalPrice,
    status,
  });

  // תזכורת לפי מדיניות (reminderLeadHours), לא לפני "עכשיו". השליחה עצמה תמומש ב-worker עתידי.
  const reminderLeadMs = reminderLeadHours * 60 * 60 * 1000;
  const sendAt = new Date(Math.max(startAt.getTime() - reminderLeadMs, Date.now() + 60_000));
  await createReminder(appointment.id, sendAt);

  // התראת בעל העסק על הזמנה הממתינה לאישור (best-effort, לעולם לא חוסמת).
  // היעד הוא מייל העסק עצמו (ownerEmail / owner.email) — לא מייל הפלטפורמה.
  if (status === 'PENDING') {
    try {
      await notifyOwnerOfBooking({
        appointmentId: appointment.id,
        businessName: business.name,
        ownerEmail: business.ownerEmail,
        ownerUserEmail: business.owner?.email ?? null,
        clientName,
        clientPhone: clientPhone ?? null,
        services: services.map((s) => ({ name: s.name, priceAgorot: s.priceAgorot })),
        startAt,
        timezone: business.timezone,
        totalPriceAgorot: totalPrice,
        approvalsUrl: absoluteUrl('/admin/appointments?tab=pending'),
      });
    } catch {
      // ההזמנה כבר נוצרה והוחזרה בהצלחה; כשל התראה אינו משפיע על התשובה.
    }
  }

  return NextResponse.json({ ok: true, appointmentId: appointment.id, status });
}
