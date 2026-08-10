import { prisma } from '@/lib/db';
import type { StaffPermission } from '@prisma/client';
import { normalizePhone } from '@/lib/crypto';

/** אנשי צוות פעילים בעסק. */
export function listStaff(businessId: string) {
  return prisma.staffMember.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** כל אנשי הצוות בעסק כולל לא־פעילים, עם פרטי המשתמש ומספר התורים (למסך הניהול). */
export function listAllStaff(businessId: string) {
  return prisma.staffMember.findMany({
    where: { businessId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { phone: true, name: true } },
      _count: { select: { appointments: true } },
    },
  });
}

/** איש צוות בודד בתוך העסק, עם פרטי המשתמש. */
export function getStaffMemberById(businessId: string, id: string) {
  return prisma.staffMember.findFirst({
    where: { id, businessId },
    include: { user: { select: { phone: true, name: true } } },
  });
}

/** איש צוות בודד עם שעות העבודה שלו. */
export function getStaffWithHours(staffId: string) {
  return prisma.staffMember.findUnique({
    where: { id: staffId },
    include: { workingHours: true },
  });
}

/** שעות העבודה של איש צוות. */
export function getStaffWorkingHours(staffId: string) {
  return prisma.workingHours.findMany({
    where: { staffId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  });
}

export type StaffInput = {
  phone: string;
  name?: string | null;
  displayName: string;
  title?: string | null;
  bio?: string | null;
  permissionLevel: StaffPermission;
  active: boolean;
};

/**
 * יצירת איש צוות חדש: מאתרים או יוצרים משתמש לפי הטלפון (מנורמל ל-E.164),
 * ואז יוצרים רשומת StaffMember. מסרבים כאשר המשתמש כבר משויך כאיש צוות בעסק.
 */
export async function createStaffMember(
  businessId: string,
  data: StaffInput,
): Promise<{ ok: true; id: string } | { ok: false; reason: 'duplicate' }> {
  const phone = normalizePhone(data.phone);

  const user = await prisma.user.upsert({
    where: { phone },
    update: data.name ? { name: data.name } : {},
    create: { phone, name: data.name ?? null, role: 'STAFF' },
  });

  const existing = await prisma.staffMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: 'duplicate' };

  const created = await prisma.staffMember.create({
    data: {
      businessId,
      userId: user.id,
      displayName: data.displayName,
      title: data.title ?? null,
      bio: data.bio ?? null,
      permissionLevel: data.permissionLevel,
      active: data.active,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/** עדכון פרטי איש צוות (מסונן לפי העסק). מעדכן גם את שם המשתמש המקושר. */
export async function updateStaffMember(
  businessId: string,
  id: string,
  data: StaffInput,
): Promise<boolean> {
  const member = await prisma.staffMember.findFirst({
    where: { id, businessId },
    select: { userId: true },
  });
  if (!member) return false;

  const phone = normalizePhone(data.phone);
  await prisma.user.update({
    where: { id: member.userId },
    data: { phone, name: data.name ?? null },
  });

  await prisma.staffMember.update({
    where: { id },
    data: {
      displayName: data.displayName,
      title: data.title ?? null,
      bio: data.bio ?? null,
      permissionLevel: data.permissionLevel,
      active: data.active,
    },
  });
  return true;
}

/** הפעלה או השבתה של איש צוות (מתג active). */
export async function setStaffActive(
  businessId: string,
  id: string,
  active: boolean,
): Promise<boolean> {
  const result = await prisma.staffMember.updateMany({
    where: { id, businessId },
    data: { active },
  });
  return result.count > 0;
}

/** מחיקת איש צוות. מסרבת כאשר משויכים אליו תורים קיימים — במקרה כזה יש להשבית. */
export async function deleteStaffMember(
  businessId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'in_use' }> {
  const member = await prisma.staffMember.findFirst({
    where: { id, businessId },
    include: { _count: { select: { appointments: true } } },
  });
  if (!member) return { ok: false, reason: 'not_found' };
  if (member._count.appointments > 0) return { ok: false, reason: 'in_use' };

  await prisma.staffMember.delete({ where: { id } });
  return { ok: true };
}
