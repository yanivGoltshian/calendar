import { prisma } from '@/lib/db';

/**
 * מציאת לקוח לפי טלפון בעסק, או יצירתו אוטומטית (upsert).
 * מקשר למשתמש אם התקבל userId.
 */
export async function findOrCreateClient(params: {
  businessId: string;
  phone: string;
  name: string;
  userId?: string;
}) {
  const existing = await prisma.client.findUnique({
    where: { businessId_phone: { businessId: params.businessId, phone: params.phone } },
  });
  if (existing) {
    // עדכון שם/קישור משתמש אם חסרים.
    if ((!existing.userId && params.userId) || (!existing.name && params.name)) {
      return prisma.client.update({
        where: { id: existing.id },
        data: {
          userId: existing.userId ?? params.userId,
          name: existing.name || params.name,
        },
      });
    }
    return existing;
  }
  return prisma.client.create({
    data: {
      businessId: params.businessId,
      phone: params.phone,
      name: params.name,
      userId: params.userId,
    },
  });
}

/** רשימת לקוחות עם חיפוש חופשי (שם/טלפון). */
export function listClients(businessId: string, query?: string) {
  return prisma.client.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** פרופיל לקוח כולל היסטוריית תורים. */
export function getClientWithHistory(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      appointments: {
        orderBy: { startAt: 'desc' },
        include: { services: true, staff: true },
      },
    },
  });
}
