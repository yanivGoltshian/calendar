import { prisma } from '@/lib/db';

/**
 * מאגר שעות עבודה — לעסק (scope BUSINESS) או לאיש צוות (scope STAFF).
 * כל יום מיוצג ברשומה אחת עם דקת התחלה, דקת סיום ומערך הפסקות [[start,end], ...].
 */

export type WorkingHoursRow = {
  weekday: number; // 0=ראשון ... 6=שבת
  startMinute: number;
  endMinute: number;
  breaks: [number, number][];
};

/** שעות העבודה של העסק (ברירת המחדל). */
export function getBusinessHours(businessId: string) {
  return prisma.workingHours.findMany({
    where: { scope: 'BUSINESS', businessId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  });
}

/** שעות העבודה של איש צוות מסוים. */
export function getStaffHours(staffId: string) {
  return prisma.workingHours.findMany({
    where: { scope: 'STAFF', staffId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  });
}

/** החלפה מלאה של שעות העסק ברשומות שהתקבלו (מוחק ובונה מחדש בטרנזקציה). */
export async function setBusinessHours(
  businessId: string,
  rows: WorkingHoursRow[],
): Promise<void> {
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { scope: 'BUSINESS', businessId } }),
    ...rows.map((row) =>
      prisma.workingHours.create({
        data: {
          scope: 'BUSINESS',
          businessId,
          weekday: row.weekday,
          startMinute: row.startMinute,
          endMinute: row.endMinute,
          breaks: row.breaks,
        },
      }),
    ),
  ]);
}

/**
 * החלפה מלאה של שעות איש צוות. מאמת שאיש הצוות שייך לעסק לפני הכתיבה.
 * מחזיר false כשאיש הצוות לא נמצא בעסק.
 */
export async function setStaffHours(
  businessId: string,
  staffId: string,
  rows: WorkingHoursRow[],
): Promise<boolean> {
  const member = await prisma.staffMember.findFirst({
    where: { id: staffId, businessId },
    select: { id: true },
  });
  if (!member) return false;

  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { scope: 'STAFF', staffId } }),
    ...rows.map((row) =>
      prisma.workingHours.create({
        data: {
          scope: 'STAFF',
          staffId,
          weekday: row.weekday,
          startMinute: row.startMinute,
          endMinute: row.endMinute,
          breaks: row.breaks,
        },
      }),
    ),
  ]);
  return true;
}
