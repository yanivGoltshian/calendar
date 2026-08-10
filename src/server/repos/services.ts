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

/** כל השירותים כולל מספר התורים שמשתמשים בכל שירות (למסך הניהול). */
export function listServicesWithUsage(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { appointmentServices: true } } },
  });
}

/** שירות בודד בתוך העסק. */
export function getServiceById(businessId: string, id: string) {
  return prisma.service.findFirst({ where: { id, businessId } });
}

export type ServiceInput = {
  name: string;
  description?: string | null;
  durationMin: number;
  priceAgorot: number;
  hidePrice: boolean;
  hideDuration: boolean;
  hidden: boolean;
};

/** יצירת שירות חדש עם מיקום מיון בסוף הרשימה. */
export async function createService(businessId: string, data: ServiceInput) {
  const last = await prisma.service.findFirst({
    where: { businessId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;
  return prisma.service.create({
    data: { businessId, sortOrder, ...data },
  });
}

/** עדכון שירות קיים (מסונן לפי העסק כדי למנוע גישה חוצה עסקים). */
export async function updateService(
  businessId: string,
  id: string,
  data: ServiceInput,
) {
  const result = await prisma.service.updateMany({
    where: { id, businessId },
    data,
  });
  return result.count > 0;
}

/** מחיקת שירות. מסרבת כאשר השירות משויך לתורים קיימים (onDelete: Restrict). */
export async function deleteService(
  businessId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'in_use' }> {
  const service = await prisma.service.findFirst({
    where: { id, businessId },
    include: { _count: { select: { appointmentServices: true } } },
  });
  if (!service) return { ok: false, reason: 'not_found' };
  if (service._count.appointmentServices > 0) {
    return { ok: false, reason: 'in_use' };
  }
  await prisma.service.delete({ where: { id } });
  return { ok: true };
}

/** מתג הצגה/הסתרה מהעמוד הציבורי. */
export async function setServiceHidden(
  businessId: string,
  id: string,
  hidden: boolean,
) {
  const result = await prisma.service.updateMany({
    where: { id, businessId },
    data: { hidden },
  });
  return result.count > 0;
}
