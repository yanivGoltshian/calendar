import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { addDaysToDateString, formatDateString, localWallTimeToUtc } from '@/lib/time';
import { computeSlots, intervalFitsWorkingHours } from '@/server/availability';
import { getDateWorkingHours } from '@/server/repos/workingHoursExceptions';
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
  const workingHours = await getDateWorkingHours(businessId, staffId, date, db);
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
  await db.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${input.businessId} FOR UPDATE`;
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
  // Approval retains its reserved interval even when the new-booking grid or lead time moves.
  const available = excludeAppointmentId
    ? intervalFitsWorkingHours(input.startAt, endAt, date, policy.workingHours, business.timezone)
    : policy.slots.some((slot) => slot.startAtUtc === input.startAt.toISOString());
  if (!available) {
    throw new BookingError('slot_unavailable', 409);
  }
  return { ...policy, endAt };
}
