import { NextResponse } from 'next/server';
import { getBusinessBySlug } from '@/server/repos/business';
import { getClientSession } from '@/lib/session';
import { getUpcomingAppointmentsForUserAtBusiness } from '@/server/repos/account';
import { getAppointmentById } from '@/server/repos/appointments';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { t } from '@/i18n';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import type { ReturningAppointmentView } from '@/components/publicLanding/ReturningCustomer';

// קורא את עוגיית ה-client_session (ובמסלול האורח את הפרמטר booked) ולכן דינמי
// וללא מטמון — מחזיר אך ורק את התורים של המבקש עצמו.
export const dynamic = 'force-dynamic';

type ReturningResponse =
  | { mode: 'returning'; name: string; appointments: ReturningAppointmentView[] }
  | { mode: 'booked'; heading: string; appointments: ReturningAppointmentView[] }
  | { mode: 'none'; appointments: [] };

/**
 * נתיב קריאה-בלבד המחשב את מקטע "שלום .." (תורים עתידיים של לקוח מזוהה בעסק זה),
 * או את באנר "התור שלך נקבע" לאורח לפי ?booked=<id>. כל החישוב (אזור זמן, קישור
 * ליומן Google, אפשרות ביטול) נעשה בשרת בדיוק כמו קודם, אך מוזרם client-side כדי
 * שה-HTML הסטטי (ISR) לא יכיל מידע אישי כלשהו.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  const none: ReturningResponse = { mode: 'none', appointments: [] };
  const noStore = { headers: { 'cache-control': 'no-store' } };
  if (!business) return NextResponse.json(none, noStore);

  const tz = business.timezone;
  const clinic = t.premiumLanding.clinic.returning;

  // לקוח מזוהה (עוגייה): תורים עתידיים בעסק זה, ממוינים מהקרוב לרחוק.
  const session = await getClientSession();
  if (session) {
    const upcoming = await getUpcomingAppointmentsForUserAtBusiness(
      { userId: session.userId, phone: session.phone, email: session.email },
      business.id,
    );
    if (upcoming.length === 0) return NextResponse.json(none, noStore);
    const nowMs = Date.now();
    const appointments: ReturningAppointmentView[] = upcoming.map((appt) => {
      const title =
        appt.services.map((s) => s.nameSnapshot).filter(Boolean).join(' + ') || business.name;
      const staffLabel = appt.staff?.displayName ? `${clinic.withStaff} ${appt.staff.displayName}` : '';
      const whenLabel = `${formatLongDate(formatDateString(appt.startAt, tz), tz)} • ${formatTime(
        appt.startAt,
        tz,
      )}`;
      const googleUrl = buildGoogleCalendarUrl({
        title,
        start: appt.startAt,
        end: appt.endAt,
        details: appt.staff?.displayName ? `${business.name} — ${appt.staff.displayName}` : business.name,
        location: business.address ?? undefined,
      });
      const windowHours = appt.business.settings?.cancellationWindowHours ?? 0;
      const canCancel = nowMs < appt.startAt.getTime() - windowHours * 3_600_000;
      return { id: appt.id, title, staffLabel, whenLabel, googleUrl, canCancel };
    });
    const name = session.name?.trim() || session.email?.split('@')[0]?.trim() || '';
    return NextResponse.json({ mode: 'returning', name, appointments } as ReturningResponse, noStore);
  }

  // אורח: אחרי קביעת תור מסך ההצלחה מפנה ל-/b/{slug}?booked={id}. נשלוף לפי מזהה,
  // נוודא שייכות לעסק זה ותור עתידי שאינו מבוטל, ונציג את אותו כרטיס — ללא ביטול.
  const bookedId = new URL(request.url).searchParams.get('booked');
  if (bookedId) {
    const appt = await getAppointmentById(bookedId);
    if (
      appt &&
      appt.businessId === business.id &&
      appt.status !== 'CANCELLED' &&
      appt.startAt.getTime() >= Date.now()
    ) {
      const title =
        appt.services.map((s) => s.nameSnapshot).filter(Boolean).join(' + ') || business.name;
      const staffLabel = appt.staff?.displayName ? `${clinic.withStaff} ${appt.staff.displayName}` : '';
      const whenLabel = `${formatLongDate(formatDateString(appt.startAt, tz), tz)} • ${formatTime(
        appt.startAt,
        tz,
      )}`;
      const googleUrl = buildGoogleCalendarUrl({
        title,
        start: appt.startAt,
        end: appt.endAt,
        details: appt.staff?.displayName ? `${business.name} — ${appt.staff.displayName}` : business.name,
        location: business.address ?? undefined,
      });
      const body: ReturningResponse = {
        mode: 'booked',
        heading: t.booking.bookingConfirmedBanner,
        appointments: [{ id: appt.id, title, staffLabel, whenLabel, googleUrl, canCancel: false }],
      };
      return NextResponse.json(body, noStore);
    }
  }

  return NextResponse.json(none, noStore);
}
