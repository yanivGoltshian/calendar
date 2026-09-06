import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { getServicesByIds } from '@/server/repos/services';
import { createAppointment } from '@/server/repos/appointments';
import { BookingError } from '@/server/booking/policy';
import { bookingDigest } from '@/server/booking/quotas';
import { notifyOwnerOfBooking } from '@/server/notifications/ownerBooking';
import { notifyClientOfBooking } from '@/server/notifications/bookingConfirmation';
import { exportOnCreate } from '@/server/google/appointmentSync';
import { getBusinessAccess, canAcceptPublicBookings } from '@/server/subscription';
import { absoluteUrl } from '@/lib/seo';
import { getClientSession } from '@/lib/session';
import { resolveGuestIdentity } from '@/server/booking/guestIdentity';
import { canEmailClients, canWhatsappClients, requiresClientEmail } from '@/server/tier';

const bodySchema = z.object({
  slug: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  startAtUtc: z.string().datetime(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
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

  const ip = extractClientIp(req);

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

  // אכיפת מנוי בצד השרת: עסק שתוקף הניסיון/המנוי שלו פג אינו מקבל הזמנות דרך העמוד
  // הציבורי. זהו הגייט האמיתי נגד ניצול (גם קריאה ישירה ל-API נחסמת, לא רק ה-UI).
  if (!canAcceptPublicBookings(business)) {
    return NextResponse.json({ ok: false, error: 'business_inactive' }, { status: 403 });
  }

  // מדיניות פרטי קשר לפי מסלול: שם + טלפון חובה בכל המסלולים (כולל סטנדרט). מייל נדרש
  // רק בפרימיום/אקסקלוסיב, שם נשלח אישור הזמנה ותזכורות במייל וקיימת הרשמת לקוחות.
  const requireEmail = requiresClientEmail(business.plan);

  // זהות הלקוח: מתוך ההתחברות אם קיימת (טלפון ו/או מייל), אחרת מפרטי הזמנת האורח.
  let clientPhone: string | undefined;
  let clientEmail: string | undefined;
  let clientName: string;
  let clientUserId: string | undefined;
  if (session) {
    clientPhone = session.phone;
    clientEmail = session.email;
    clientName = parsed.name ?? session.name ?? session.phone ?? session.email ?? 'לקוח';
    clientUserId = session.userId;
  } else {
    // חוקת זהות אורח חולצה לפונקציה טהורה `resolveGuestIdentity` (משותפת עם המבחן).
    const guest = resolveGuestIdentity(parsed.name, parsed.phone, parsed.email, {
      requireEmail,
    });
    if (!guest.ok) {
      return NextResponse.json({ ok: false, error: guest.error }, { status: 400 });
    }
    clientPhone = guest.phone;
    clientEmail = guest.email;
    clientName = guest.name;
    clientUserId = undefined;
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

  const settings = business.settings;

  const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.priceAgorot, 0);
  const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

  const requestHash = bookingDigest(
    JSON.stringify({
      businessId: business.id,
      staffId: parsed.staffId,
      serviceIds: [...parsed.serviceIds].sort(),
      startAtUtc: startAt.toISOString(),
      name: clientName,
      phone: clientPhone,
      email: clientEmail,
    }),
  );
  // Only a caller-held key can replay a guest receipt; contact details alone cannot.
  const key = req.headers.get('Idempotency-Key') ?? parsed.idempotencyKey ?? randomUUID();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_idempotency_key' },
      { status: 400 },
    );
  }
  const scope = bookingDigest(
    JSON.stringify({
      businessId: business.id,
      userId: clientUserId,
      phone: clientPhone,
      email: clientEmail,
    }),
  );
  let appointment;
  try {
    appointment = await createAppointment({
      businessId: business.id,
      clientIdentity: {
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        userId: clientUserId,
      },
      idempotency: { scope, key, requestHash },
      source: ip ?? undefined,
      publicBooking: true,
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
    });
  } catch (error) {
    if (error instanceof BookingError) {
      console.warn(
        JSON.stringify({
          event: 'booking_denied',
          businessId: business.id,
          reason: error.code,
        }),
      );
      return NextResponse.json(
        { ok: false, error: error.code },
        {
          status: error.httpStatus,
          ...(error.httpStatus === 429 ? { headers: { 'Retry-After': '3600' } } : {}),
        },
      );
    }
    throw error;
  }
  const status = appointment.status;
  if (appointment.replayed)
    return NextResponse.json({ ok: true, appointmentId: appointment.id, status });

  // אישור הזמנה מיידי ללקוח בנתיב CONFIRMED לפי הרשאות המסלול (best-effort, לעולם לא
  // חוסם). המנוי חייב להיות פעיל כדי לפתוח ערוצים בתשלום. בסטנדרט אין ערוצי תקשורת.
  if (status === 'CONFIRMED') {
    const access = getBusinessAccess(business);
    const canEmail = access.active && canEmailClients(business.plan);
    const canWhatsapp = access.active && canWhatsappClients(business.plan);
    if (canEmail || canWhatsapp) {
      try {
        await notifyClientOfBooking({
          appointmentId: appointment.id,
          businessId: business.id,
          businessName: business.name,
          clientName,
          clientEmail: clientEmail ?? null,
          clientPhone: clientPhone ?? null,
          services: services.map((s) => ({ name: s.name })),
          startAt,
          timezone: business.timezone,
          canEmail,
          canWhatsapp,
          businessPhone: business.phone,
          businessAddress: business.address,
          manageUrl: absoluteUrl(`/b/${business.slug}`),
        });
      } catch (error) {
        console.error('booking_client_notification_failed', {
          appointmentId: appointment.id,
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    }
  }

  // התראת בעל העסק על הזמנה חדשה (best-effort, לעולם לא חוסמת). מופעלת בשני
  // המסלולים — גם תור הממתין לאישור וגם תור שאושר אוטומטית (CONFIRMED) — כדי
  // שבעל העסק יידע על כל הזמנה, לא רק על תור שדורש אישור. מכובד מתג notifyOnBooking
  // (ברירת מחדל דלוקה). היעד הוא מייל העסק עצמו (ownerEmail / owner.email) — לא
  // מייל הפלטפורמה. businessId ו-pushEnabled מזרימים את ערוץ ה-Web Push.
  if (settings?.notifyOnBooking ?? true) {
    const pendingApproval = status === 'PENDING';
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
        requiresApproval: pendingApproval,
        approvalsUrl: absoluteUrl(
          pendingApproval ? '/admin/appointments?tab=pending' : '/admin/appointments',
        ),
        businessId: business.id,
        pushEnabled: settings?.pushEnabled ?? false,
      });
    } catch (error) {
      console.error('booking_owner_notification_failed', {
        appointmentId: appointment.id,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  // ייצוא ליומן Google של הבעלים (fire-and-forget, לעולם לא חוסם את התשובה).
  // מגודר פנימית ב-env ומדלג כשאין חיבור/כיבוי; מוגן במלואו ולא זורק.
  void exportOnCreate(appointment.id).catch(() => {});

  return NextResponse.json({ ok: true, appointmentId: appointment.id, status });
}
