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
import { getClientSession } from '@/lib/session';

const bodySchema = z.object({
  slug: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  startAtUtc: z.string().datetime(),
  name: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  // חובה התחברות (אימות טלפון הושלם) לפני קביעת תור.
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const business = await getBusinessBySlug(parsed.slug);
  if (!business) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
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

  const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.priceAgorot, 0);
  const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

  // בדיקת התנגשות אחרונה לפני יצירה (מונע קביעה כפולה על אותה משבצת).
  if (await hasConflict(parsed.staffId, startAt, endAt)) {
    return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 });
  }

  // יצירה/איתור לקוח לפי טלפון מתוך ההתחברות.
  const client = await findOrCreateClient({
    businessId: business.id,
    phone: session.phone,
    name: parsed.name ?? session.name ?? session.phone,
    userId: session.userId,
  });

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
  });

  // תזכורת ברירת מחדל: 24 שעות לפני התור (לא לפני "עכשיו"). השליחה עצמה תמומש ב-worker עתידי.
  const reminderLeadMs = 24 * 60 * 60 * 1000;
  const sendAt = new Date(Math.max(startAt.getTime() - reminderLeadMs, Date.now() + 60_000));
  await createReminder(appointment.id, sendAt);

  return NextResponse.json({ ok: true, appointmentId: appointment.id });
}
