import type { BusinessType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getServiceTemplate } from '@/server/onboarding/serviceTemplates';

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

/** כל השירותים כולל מספר התורים שמשתמשים בכל שירות ואנשי הצוות המשויכים (למסך הניהול). */
export function listServicesWithUsage(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { appointmentServices: true } },
      staffLinks: {
        include: { staff: { select: { id: true, displayName: true, active: true } } },
      },
    },
  });
}

/** מזהי אנשי הצוות המשויכים לשירות. */
export async function getServiceStaffIds(
  businessId: string,
  serviceId: string,
): Promise<string[]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { staffLinks: { select: { staffId: true } } },
  });
  if (!service) return [];
  return service.staffLinks.map((link) => link.staffId);
}

/**
 * סנכרון שיוך שירות ↔ אנשי צוות: משאיר רק את המזהים שהתקבלו.
 * מוודא שהשירות ואנשי הצוות שייכים לעסק, מוחק קישורים שהוסרו ומוסיף חדשים.
 */
export async function setServiceStaff(
  businessId: string,
  serviceId: string,
  staffIds: string[],
): Promise<boolean> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true },
  });
  if (!service) return false;

  // סינון למזהי צוות ששייכים באמת לעסק — הגנה מפני גישה חוצת־עסקים.
  const validStaff = await prisma.staffMember.findMany({
    where: { businessId, id: { in: staffIds } },
    select: { id: true },
  });
  const desired = new Set(validStaff.map((s) => s.id));

  const current = await prisma.serviceStaff.findMany({
    where: { serviceId },
    select: { staffId: true },
  });
  const currentSet = new Set(current.map((c) => c.staffId));

  const toAdd = [...desired].filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !desired.has(id));

  await prisma.$transaction([
    ...(toRemove.length
      ? [
          prisma.serviceStaff.deleteMany({
            where: { serviceId, staffId: { in: toRemove } },
          }),
        ]
      : []),
    ...toAdd.map((staffId) =>
      prisma.serviceStaff.create({ data: { serviceId, staffId } }),
    ),
  ]);
  return true;
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
export async function createService(businessId: string, data: ServiceInput, staffIds?: string[]) {
  const last = await prisma.service.findFirst({
    where: { businessId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;
  const staff = await prisma.staffMember.findMany({
    where: { businessId, active: true, ...(staffIds === undefined ? {} : { id: { in: staffIds } }) },
    select: { id: true },
    ...(staffIds === undefined ? { take: 2 } : {}),
  });
  if (staffIds !== undefined && new Set(staffIds).size !== staff.length) {
    throw new Error('invalid_service_staff');
  }
  const assigned = staffIds !== undefined || staff.length === 1 ? staff : [];
  return prisma.service.create({
    data: { businessId, sortOrder, ...data, staffLinks: { create: assigned.map(member => ({ staffId: member.id })) } },
  });
}

/**
 * זריעת שירותי התחלה מתבנית סוג העסק (אונבורדינג).
 * אידמפוטנטי: רץ רק כשלעסק אין אף שירות, ולכן קריאה חוזרת לא תיצור כפילויות.
 * מחזיר את מספר השירותים שנוצרו (0 אם כבר קיימים שירותים או שהתבנית ריקה).
 */
export async function seedServicesForBusiness(
  businessId: string,
  type: BusinessType | null | undefined,
): Promise<number> {
  const existing = await prisma.service.count({ where: { businessId } });
  if (existing > 0) return 0;

  const template = getServiceTemplate(type);
  if (template.length === 0) return 0;

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
    if (await tx.service.count({ where: { businessId } })) return 0;
    const staff = await tx.staffMember.findMany({
      where: { businessId, active: true }, select: { id: true }, take: 2,
    });
    const created = await tx.service.createManyAndReturn({
      data: template.map((svc, index) => ({
        businessId, name: svc.name, durationMin: svc.durationMin,
        priceAgorot: svc.priceAgorot, sortOrder: index,
      })),
      select: { id: true },
    });
    if (staff.length === 1) {
      await tx.serviceStaff.createMany({
        data: created.map(service => ({ serviceId: service.id, staffId: staff[0].id })),
      });
    }
    return created.length;
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

type DeleteServiceResult = { ok: true } | { ok: false; reason: 'not_found' | 'in_use' };

/** Removes only unused services, preserving appointment, waitlist, package and sales references. */
export async function deleteService(
  businessId: string,
  id: string,
): Promise<DeleteServiceResult> {
  return prisma.$transaction(async (tx): Promise<DeleteServiceResult> => {
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${id} AND "businessId" = ${businessId} FOR UPDATE`;
    const service = await tx.service.findFirst({
      where: { id, businessId },
      include: { _count: { select: { appointmentServices: true, waitlistEntries: true, punchCards: true } } },
    });
    if (!service) return { ok: false, reason: 'not_found' };
    if (Object.values(service._count).some(count => count > 0) ||
      await tx.saleItem.count({ where: { serviceId: id } }) > 0) {
      return { ok: false, reason: 'in_use' };
    }
    await tx.service.delete({ where: { id } });
    return { ok: true };
  });
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
