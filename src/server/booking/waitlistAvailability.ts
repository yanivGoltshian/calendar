import { prisma } from '@/lib/db';
import { isGregorianDate } from '@/lib/workingHoursExceptions';
import { addDaysToDateString, formatDateString, utcToLocalParts } from '@/lib/time';
import { bookingPolicy, BookingError } from './policy';

/** A dated waitlist invitation must have a real bookable slot before claiming delivery. */
export async function exceptionsAllowWaitlistOffer(entry: {
  businessId: string; staffId: string | null; serviceId: string | null;
  desiredDate: string | null; earliestMinute: number | null; latestMinute: number | null;
}): Promise<boolean> {
  if (!entry.desiredDate) return true;
  const date = entry.desiredDate;
  if (!isGregorianDate(date)) return false;
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
      if (policy.slots.some((slot) => {
        const endAt = new Date(slot.endAtUtc);
        const endDate = formatDateString(endAt, policy.business.timezone);
        const endMinute = utcToLocalParts(endAt, policy.business.timezone).minutes +
          (endDate === date ? 0 : endDate === addDaysToDateString(date, 1) ? 1440 : Infinity);
        return slot.startMinute >= (entry.earliestMinute ?? 0) &&
          slot.startMinute < (entry.latestMinute ?? 1440) &&
          endMinute <= (entry.latestMinute ?? 1440);
      })) return true;
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
    }
  }
  return false;
}
