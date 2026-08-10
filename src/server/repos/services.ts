import { prisma } from '@/lib/db';

/** שירותים לפי מזהים (לבחירה בזרימת ההזמנה). */
export function getServicesByIds(businessId: string, ids: string[]) {
  return prisma.service.findMany({
    where: { businessId, id: { in: ids } },
  });
}

/** כל השירותים של עסק. */
export function listServices(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
  });
}
