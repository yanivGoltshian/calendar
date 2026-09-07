import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { addDaysToDateString, formatDateString, localWallTimeToUtc, weekdayForDateString } from '@/lib/time';
import { computeSlots } from '@/server/availability';
import { getEffectiveStaffWorkingHours } from '@/server/repos/workingHours';
import { canAcceptPublicBookings } from '@/server/subscription';

export const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'ARRIVED', 'DONE'] as const;

export class BookingError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus = 400,
  ) {
    super(code);
    this.name = 'BookingError';
  }
}

export async function expirePendingReservations(
  businessId: string,
  db: Prisma.TransactionClient = prisma,
  now = new Date(),
) {
  const expired = await db.appointment.updateMany({
    where: { businessId, status: 'PENDING', pendingExpiresAt: { lte: now } },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: 'EXPIRY',
      googleSyncPending: true,
    },
  });
  if (expired.count)
    await db.reminder.updateMany({
      where: {
        status: { in: ['SCHEDULED', 'FAILED'] },
        appointment: { businessId, status: 'CANCELLED', cancelledBy: 'EXPIRY' },
      },
      data: { status: 'CANCELLED' },
    });
  return expired;
}

export async function bookingPolicy(
  businessId: string,
  staffId: string,
  serviceIds: string[],
  date: string,
  db: Prisma.TransactionClient = prisma,
  now = new Date(),
  excludeAppointmentId?: string,
) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { settings: true },
  });
  if (
    !business ||
    !canAcceptPublicBookings(business) ||
    business.accountStatus !== 'ACTIVE'
  ) {
    throw new BookingError('business_inactive', 403);
  }
  const staff = await db.staffMember.findFirst({
    where: { id: staffId, businessId, active: true },
  });
  if (!staff) throw new BookingError('invalid_staff');
  const services = await db.service.findMany({
    where: { businessId, id: { in: serviceIds }, hidden: false },
  });
  if (
    serviceIds.length === 0 ||
    new Set(serviceIds).size !== serviceIds.length ||
    services.length !== serviceIds.length
  )
    throw new BookingError('invalid_service');
  const links = await db.serviceStaff.count({
    where: { staffId, serviceId: { in: serviceIds } },
  });
  if (links !== services.length) throw new BookingError('staff_service_mismatch');
  const [year, month, day] = date.split('-').map(Number);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date
  ) {
    throw new BookingError('invalid_time');
  }
  const start = localWallTimeToUtc(year, month, day, 0, business.timezone);
  const [ny, nm, nd] = addDaysToDateString(date, 1).split('-').map(Number);
  const end = localWallTimeToUtc(ny, nm, nd, 0, business.timezone);
  const hours = await getEffectiveStaffWorkingHours(businessId, staffId, db);
  const busy = await db.appointment.findMany({
    where: {
      staffId,
      status: { in: [...BLOCKING_STATUSES] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });
  const durationMin = services.reduce((sum, service) => sum + service.durationMin, 0);
  const workingHours = hours.map((hour) => ({
    ...hour,
    breaks: Array.isArray(hour.breaks)
      ? hour.breaks.filter(
          (pair): pair is [number, number] =>
            Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite),
        )
      : [],
  }));
  const slots = computeSlots({
    dateStr: date,
    workingHours,
    busy,
    durationMin,
    slotGranularityMin: business.settings?.slotGranularityMinutes ?? 30,
    minLeadTimeMinutes: business.settings?.minLeadTimeMinutes ?? 0,
    timeZone: business.timezone,
    now,
  }).filter(
    (slot) =>
      new Date(slot.startAtUtc).getTime() <=
      now.getTime() + (business.settings?.maxAdvanceBookingDays ?? 30) * 86_400_000,
  );
  return {
    business,
    staff,
    services,
    durationMin,
    slots,
    busy,
    workingHours,
    dayStart: start,
    dayEnd: end,
  };
}

export async function assertBookable(
  input: { businessId: string; staffId: string; serviceIds: string[]; startAt: Date },
  db: Prisma.TransactionClient,
  now: Date,
  excludeAppointmentId?: string,
) {
  if (!Number.isFinite(input.startAt.getTime()) || input.startAt <= now) {
    throw new BookingError('invalid_time');
  }
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: { timezone: true },
  });
  if (!business) throw new BookingError('business_inactive', 403);
  const policy = await bookingPolicy(
    input.businessId,
    input.staffId,
    input.serviceIds,
    formatDateString(input.startAt, business.timezone),
    db,
    now,
    excludeAppointmentId,
  );
  const endAt = new Date(input.startAt.getTime() + policy.durationMin * 60_000);
  if (policy.busy.some((busy) => busy.startAt < endAt && busy.endAt > input.startAt)) {
    throw new BookingError('slot_taken', 409);
  }
  const date = formatDateString(input.startAt, business.timezone);
  const [year, month, day] = date.split('-').map(Number);
  // Approval retains its reserved interval even when the new-booking grid or lead time moves.
  const available = excludeAppointmentId
    ? policy.workingHours.some((hour) =>
        hour.weekday === weekdayForDateString(date, business.timezone) &&
        input.startAt >= localWallTimeToUtc(year, month, day, hour.startMinute, business.timezone) &&
        endAt <= localWallTimeToUtc(year, month, day, hour.endMinute, business.timezone) &&
        !hour.breaks.some(([start, end]) =>
          input.startAt < localWallTimeToUtc(year, month, day, end, business.timezone) &&
          endAt > localWallTimeToUtc(year, month, day, start, business.timezone)))
    : policy.slots.some((slot) => slot.startAtUtc === input.startAt.toISOString());
  if (!available) {
    throw new BookingError('slot_unavailable', 409);
  }
  return { ...policy, endAt };
}
