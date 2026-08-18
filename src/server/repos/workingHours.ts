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

/** שורת שעות עבודה מינימלית כפי שנדרשת לחישוב זמינות. */
export type EffectiveHoursRow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breaks: unknown;
};

/**
 * מנשק צר (structural) של לקוח Prisma עבור שליפת שעות עבודה בלבד.
 * מאפשר הזרקה של לקוח מזויף בבדיקות בלי תלות ב-DB חי.
 */
export type WorkingHoursClient = {
  workingHours: {
    findMany(args: {
      where: { scope: 'STAFF' | 'BUSINESS'; staffId?: string; businessId?: string };
      orderBy?: unknown;
    }): Promise<EffectiveHoursRow[]>;
  };
};

/**
 * שעות העבודה ה"אפקטיביות" של איש צוות לחישוב זמינות:
 * אם מוגדרות לו שעות ברמת STAFF — מחזירים אותן.
 * אחרת נופלים בחזרה לשעות העסק (BUSINESS) כברירת מחדל, כדי שאיש צוות חדש
 * שעדיין לא הוגדרו לו שעות ייעודיות עדיין יהיה זמין להזמנה (במקום ריק לגמרי).
 *
 * מקבל `client` להזרקה בבדיקות; בברירת המחדל משתמשים ב-singleton של Prisma.
 */
export async function getEffectiveStaffWorkingHours(
  businessId: string,
  staffId: string,
  client: WorkingHoursClient = prisma as unknown as WorkingHoursClient,
): Promise<EffectiveHoursRow[]> {
  const staffHours = await client.workingHours.findMany({
    where: { scope: 'STAFF', staffId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  });
  if (staffHours.length > 0) return staffHours;

  return client.workingHours.findMany({
    where: { scope: 'BUSINESS', businessId },
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
