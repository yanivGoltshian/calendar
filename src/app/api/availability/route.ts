import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessBySlug } from '@/server/repos/business';
import { getGoogleBusyIntervals } from '@/server/google/importBusy';
import {
  bookingPolicy,
  BookingError,
  expirePendingReservations,
} from '@/server/booking/policy';
import { canAcceptPublicBookings } from '@/server/subscription';

const schema = z.object({
  slug: z.string().min(1).max(100),
  staffId: z.string().min(1).max(100),
  serviceIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const probeSchema = z.object({
  slug: z.string().min(1).max(100),
  probe: z.literal(true),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const probe = probeSchema.safeParse(body);
  const parsed = schema.safeParse(body);
  if (!probe.success && !parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }
  const slug = probe.success ? probe.data.slug : parsed.success ? parsed.data.slug : '';
  const business = await getBusinessBySlug(slug);
  if (!business)
    return NextResponse.json({ ok: false, error: 'business_not_found' }, { status: 404 });
  const blocked =
    business.accountStatus !== 'ACTIVE' || !canAcceptPublicBookings(business);
  if (probe.success || blocked)
    return NextResponse.json({ ok: true, durationMin: 0, slots: [], blocked });
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  try {
    await expirePendingReservations(business.id);
    const { staffId, serviceIds, date } = parsed.data;
    const policy = await bookingPolicy(business.id, staffId, serviceIds, date);
    const googleBusy = await getGoogleBusyIntervals(
      staffId,
      policy.dayStart,
      policy.dayEnd,
    );
    const slots = policy.slots.filter(
      (slot) =>
        !googleBusy.some(
          (busy) =>
            busy.startAt < new Date(slot.endAtUtc) &&
            busy.endAt > new Date(slot.startAtUtc),
        ),
    );
    return NextResponse.json({
      ok: true,
      durationMin: policy.durationMin,
      blocked: false,
      slots: slots.map(({ label, startAtUtc, endAtUtc }) => ({
        label,
        startAtUtc,
        endAtUtc,
      })),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json(
        { ok: false, error: error.code },
        { status: error.httpStatus },
      );
    }
    throw error;
  }
}
