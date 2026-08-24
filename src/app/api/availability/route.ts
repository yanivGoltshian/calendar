import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { getServicesByIds } from '@/server/repos/services';
import { getEffectiveStaffWorkingHours } from '@/server/repos/workingHours';
import { getBlockingAppointments } from '@/server/repos/appointments';
import { getGoogleBusyIntervals } from '@/server/google/importBusy';
import { computeSlots } from '@/server/availability';
import { canAcceptPublicBookings } from '@/server/subscription';
import { localWallTimeToUtc, addDaysToDateString } from '@/lib/time';

const schema = z.object({
  slug: z.string(),
  staffId: z.string(),
  serviceIds: z.array(z.string()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * חישוב שעות פנויות: מקבל עסק, איש צוות, שירותים ותאריך — ומחזיר משבצות זמן.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const { slug, staffId, serviceIds, date } = parsed.data;

  const business = await getBusinessBySlug(slug);
  if (!business) {
    return NextResponse.json({ ok: false, error: 'business_not_found' }, { status: 404 });
  }

  // אכיפת מנוי: עסק שפג תוקפו אינו מציג משבצות פנויות (הגנה בעומק לצד הגייט בעמוד
  // ההזמנה). מחזירים רשימה ריקה עם דגל blocked כדי שה-UI יוכל להציג הודעת חוסם.
  if (!canAcceptPublicBookings(business)) {
    return NextResponse.json({ ok: true, durationMin: 0, slots: [], blocked: true });
  }

  // ודא שאיש הצוות שייך לעסק.
  const staff = business.staff.find((s) => s.id === staffId);
  if (!staff) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
  }

  const services = await getServicesByIds(business.id, serviceIds);
  if (services.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_services' }, { status: 400 });
  }
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);

  // שעות אפקטיביות: שעות איש הצוות, ובהיעדרן — נפילה לשעות העסק (ברירת מחדל).
  const workingHours = await getEffectiveStaffWorkingHours(business.id, staffId);

  // טווח UTC ליום המבוקש (מחצות עד חצות מקומי) לשליפת תורים קיימים.
  const [y, m, d] = date.split('-').map(Number);
  const dayStartUtc = localWallTimeToUtc(y, m, d, 0, business.timezone);
  const nextDate = addDaysToDateString(date, 1);
  const [ny, nm, nd] = nextDate.split('-').map(Number);
  const dayEndUtc = localWallTimeToUtc(ny, nm, nd, 0, business.timezone);

  const busy = await getBlockingAppointments(staffId, dayStartUtc, dayEndUtc);

  // שילוב עומס מיומן Google של הבעלים (best-effort, fail-open). כשהסנכרון כבוי
  // ב-env הפונקציה חוזרת מיד עם [] וללא גישת DB. מרווחי Google נספחים לתורים
  // הקיימים ומטופלים זהה בחישוב המשבצות (שניהם נקראים לפי startAt/endAt בלבד).
  const googleBusy = await getGoogleBusyIntervals(staffId, dayStartUtc, dayEndUtc);
  const busyAll = googleBusy.length > 0 ? [...busy, ...googleBusy] : busy;

  const slots = computeSlots({
    dateStr: date,
    workingHours: workingHours.map((w) => ({
      weekday: w.weekday,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
      breaks: (w.breaks as [number, number][]) ?? [],
    })),
    busy: busyAll,
    durationMin,
    slotGranularityMin: business.settings?.slotGranularityMinutes ?? 15,
    timeZone: business.timezone,
    minLeadTimeMinutes: business.settings?.minLeadTimeMinutes ?? 0,
  });

  return NextResponse.json({
    ok: true,
    durationMin,
    slots: slots.map((s) => ({ label: s.label, startAtUtc: s.startAtUtc, endAtUtc: s.endAtUtc })),
  });
}
