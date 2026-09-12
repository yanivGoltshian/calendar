import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatDateString, addDaysToDateString, localWallTimeToUtc } from '@/lib/time';
import {
  normalizeException, resolveExceptionHours, MAX_EXCEPTION_RULES,
  exceptionMatches,
  type DayHours, type ExceptionRule,
} from '@/lib/workingHoursExceptions';
import { bookingTransaction } from '@/server/booking/transaction';
import { intervalFitsWorkingHours } from '@/server/availability';

export class HoursExceptionError extends Error {
  constructor(public readonly code: 'invalid' | 'staff' | 'limit' | 'missing') {
    super(code);
  }
}

export async function listHoursExceptions(
  businessId: string, db: Prisma.TransactionClient = prisma, now = new Date(),
) {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId }, select: { timezone: true },
  });
  const today = formatDateString(now, business.timezone);
  return db.workingHoursException.findMany({
    where: { businessId, OR: [{ recurrence: { not: 'ONCE' } }, { endDate: { gte: today } }] },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: MAX_EXCEPTION_RULES + 1,
  });
}

export async function createHoursException(businessId: string, input: unknown) {
  let rule: ReturnType<typeof normalizeException>;
  try {
    rule = normalizeException(input);
  } catch (error) {
    if (error instanceof Error && (error.name === 'ZodError' ||
        ['invalid_date', 'invalid_exception'].includes(error.message))) {
      throw new HoursExceptionError('invalid');
    }
    throw error;
  }
  return bookingTransaction(async (db) => {
    // This write serializes rule quotas and invalidates concurrent booking snapshots.
    const business = await db.business.update({
      where: { id: businessId }, data: { updatedAt: new Date() },
    });
    if (rule.staffId && !await db.staffMember.findFirst({
      where: { id: rule.staffId, businessId, active: true }, select: { id: true },
    })) throw new HoursExceptionError('staff');
    const today = formatDateString(new Date(), business.timezone);
    if (rule.recurrence === 'ONCE' && rule.endDate < today) throw new HoursExceptionError('invalid');
    await db.workingHoursException.deleteMany({
      where: { businessId, recurrence: 'ONCE', endDate: { lt: today } },
    });
    if (await db.workingHoursException.count({ where: { businessId } }) >= MAX_EXCEPTION_RULES) {
      throw new HoursExceptionError('limit');
    }
    return db.workingHoursException.create({ data: { businessId, ...rule } });
  });
}

export async function deleteHoursException(businessId: string, id: string) {
  return bookingTransaction(async (db) => {
    await db.business.update({ where: { id: businessId }, data: { updatedAt: new Date() } });
    const result = await db.workingHoursException.deleteMany({ where: { id, businessId } });
    if (!result.count) throw new HoursExceptionError('missing');
  });
}

export function normalizeHours(
  hours: { weekday: number; startMinute: number; endMinute: number; breaks: unknown }[],
): DayHours[] {
  return hours.map((hour) => ({
    ...hour,
    breaks: Array.isArray(hour.breaks) ? hour.breaks.filter(
      (pair): pair is [number, number] => Array.isArray(pair) &&
        pair.length === 2 && pair.every(Number.isFinite),
    ) : [],
  }));
}

export async function getDateWorkingHours(
  businessId: string, staffId: string, date: string, db: Prisma.TransactionClient = prisma,
) {
  const staffHours = await db.workingHours.findMany({
    where: { scope: 'STAFF', staffId, staff: { businessId } },
  });
  const regular = staffHours.length ? staffHours
    : await db.workingHours.findMany({ where: { scope: 'BUSINESS', businessId } });
  const rules = await db.workingHoursException.findMany({
    where: { businessId, startDate: { lte: date }, OR: [{ staffId: null }, { staffId }] },
    take: MAX_EXCEPTION_RULES + 1,
  });
  return resolveExceptionHours(normalizeHours(regular), rules, staffId, date, staffHours.length === 0);
}

/** Information only: never edits appointments, histories, reminders or provider state. */
export async function getHoursExceptionConflicts(businessId: string, now = new Date()) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const today = formatDateString(now, business.timezone);
  const through = addDaysToDateString(today, 366);
  const [y, m, d] = through.split('-').map(Number);
  const rules: ExceptionRule[] = await listHoursExceptions(businessId, prisma, now);
  if (rules.length === 0) return { conflicts: [], truncated: false, through };
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId, status: { in: ['PENDING', 'CONFIRMED', 'ARRIVED'] },
      endAt: { gt: now }, startAt: { lt: localWallTimeToUtc(y, m, d, 0, business.timezone) },
    },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }], take: 1001,
    select: { id: true, staffId: true, startAt: true, endAt: true, staff: { select: { displayName: true } } },
  });
  const hours = await prisma.workingHours.findMany({
    where: { OR: [{ businessId, scope: 'BUSINESS' }, { scope: 'STAFF', staff: { businessId } }] },
  });
  const conflicts = appointments.slice(0, 1000).filter((appointment) => {
    const date = formatDateString(appointment.startAt, business.timezone);
    const personal = hours.filter((hour) => hour.staffId === appointment.staffId);
    const regular = normalizeHours(personal.length ? personal : hours.filter((hour) => hour.scope === 'BUSINESS'));
    const effective = resolveExceptionHours(regular, rules, appointment.staffId, date, personal.length === 0);
    // Only flag restrictions introduced by exceptions, including bookings already outside weekly hours.
    return rules.length > 0 && !intervalFitsWorkingHours(
      appointment.startAt, appointment.endAt, date, effective, business.timezone,
    ) && rules.some((rule) => (rule.staffId === null || rule.staffId === appointment.staffId) &&
      exceptionMatches(rule, date));
  });
  return { conflicts, truncated: appointments.length > 1000, through };
}

export async function cleanupExpiredHoursExceptions(now = new Date()): Promise<number> {
  const deleted = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM "WorkingHoursException"
    WHERE "id" IN (
      SELECT e."id" FROM "WorkingHoursException" e
      JOIN "Business" b ON b."id" = e."businessId"
      WHERE e."recurrence" = 'ONCE'
        AND e."endDate" < to_char(${now}::timestamptz AT TIME ZONE b."timezone", 'YYYY-MM-DD')
      ORDER BY e."endDate", e."id" LIMIT 1000
    ) AND "recurrence" = 'ONCE'
    RETURNING "id"`;
  return deleted.length;
}
