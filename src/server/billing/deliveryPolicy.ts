import { prisma } from '@/lib/db';
import { getBusinessAccess } from '@/server/subscription';

/** Read current lifecycle state, never trust a tier flag captured at booking time. */
export async function canDeliverClientEmail(businessId: string, appointmentId?: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.accountStatus !== 'ACTIVE' ||
      business.plan === 'basic' || !getBusinessAccess(business).active) return false;
  if (appointmentId) {
    return !!await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId, status: 'CONFIRMED' },
    });
  }
  return true;
}
