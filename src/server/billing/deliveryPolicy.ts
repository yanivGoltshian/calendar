import { prisma } from '@/lib/db';
import { getBusinessAccess, type BusinessAccessInput } from '@/server/subscription';

export function hasActiveClientEmailAccess(
  business: BusinessAccessInput | null | undefined,
): boolean {
  return business != null &&
    business.accountStatus === 'ACTIVE' &&
    getBusinessAccess(business).active;
}

/** Read current lifecycle state, never trust a tier flag captured at booking time. */
export async function canDeliverClientEmail(businessId: string, appointmentId?: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!hasActiveClientEmailAccess(business)) return false;
  if (appointmentId) {
    return !!await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId, status: 'CONFIRMED' },
    });
  }
  return true;
}
