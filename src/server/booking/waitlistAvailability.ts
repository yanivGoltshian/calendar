import { prisma } from '@/lib/db';
import { exceptionMatches, isGregorianDate, MAX_EXCEPTION_RULES } from '@/lib/workingHoursExceptions';
import { bookingPolicy, BookingError } from './policy';

/** A dated waitlist invitation must respect applicable exceptions before claiming delivery. */
export async function exceptionsAllowWaitlistOffer(entry: {
  businessId: string; staffId: string | null; serviceId: string | null;
  desiredDate: string | null; earliestMinute: number | null; latestMinute: number | null;
}): Promise<boolean> {
  if (!entry.desiredDate) return true;
  const date = entry.desiredDate;
  if (!isGregorianDate(date)) return false;
  const rules = await prisma.workingHoursException.findMany({
    where: {
      businessId: entry.businessId, startDate: { lte: date },
      ...(entry.staffId ? { OR: [{ staffId: null }, { staffId: entry.staffId }] } : {}),
    }, take: MAX_EXCEPTION_RULES + 1,
  });
  if (rules.length > MAX_EXCEPTION_RULES) return false;
  if (!rules.some((rule) => exceptionMatches(rule, date))) return true;
  const serviceWhere = {
    businessId: entry.businessId, hidden: false, ...(entry.serviceId ? { id: entry.serviceId } : {}),
  };
  const staff = await prisma.staffMember.findMany({
    where: {
      businessId: entry.businessId, active: true, ...(entry.staffId ? { id: entry.staffId } : {}),
      serviceLinks: { some: { service: serviceWhere } },
    },
    include: {
      serviceLinks: { where: { service: serviceWhere }, orderBy: { service: { durationMin: 'asc' } }, take: 1 },
    },
    orderBy: { id: 'asc' }, take: 51,
  });
  if (staff.length > 50) return false;
  for (const member of staff) {
    const service = member.serviceLinks[0];
    if (!service) continue;
    try {
      const policy = await bookingPolicy(entry.businessId, member.id, [service.serviceId], date);
      if (policy.slots.some((slot) => slot.startMinute >= (entry.earliestMinute ?? 0) &&
          slot.startMinute + policy.durationMin <= (entry.latestMinute ?? 1440))) return true;
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
    }
  }
  return false;
}
