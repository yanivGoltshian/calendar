import { prisma } from '@/lib/db';
import type { AppointmentStatus } from '@prisma/client';

// סטטוסים שתופסים משבצת זמן ולכן חוסמים זמינות.
const BLOCKING_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'DONE'];

/** תורים חוסמים של איש צוות בטווח זמן (UTC), לצורך חישוב זמינות. */
export function getBlockingAppointments(staffId: string, fromUtc: Date, toUtc: Date) {
  return prisma.appointment.findMany({
    where: {
      staffId,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: toUtc },
      endAt: { gt: fromUtc },
    },
    select: { startAt: true, endAt: true },
  });
}

/** תורים של איש צוות ליום מסוים (טווח UTC), עם לקוח ושירותים — לתצוגת יומן. */
export function getAppointmentsForStaffRange(staffId: string, fromUtc: Date, toUtc: Date) {
  return prisma.appointment.findMany({
    where: {
      staffId,
      startAt: { gte: fromUtc, lt: toUtc },
      status: { not: 'CANCELLED' },
    },
    orderBy: { startAt: 'asc' },
    include: {
      client: true,
      services: true,
    },
  });
}

/**
 * כל התורים (לא מבוטלים) של העסק בטווח UTC — לתצוגת יומן רב-צוותי (יום/שבוע).
 * כולל לקוח ושירותים; ה-staffId זמין לפילוח לעמודות לפי איש צוות.
 */
export function getAppointmentsForBusinessRange(
  businessId: string,
  fromUtc: Date,
  toUtc: Date,
) {
  return prisma.appointment.findMany({
    where: {
      businessId,
      startAt: { gte: fromUtc, lt: toUtc },
      status: { not: 'CANCELLED' },
    },
    orderBy: { startAt: 'asc' },
    include: {
      client: true,
      services: true,
    },
  });
}

/** בדיקת חפיפה: האם קיים תור חוסם שמתנגש עם הטווח המבוקש. */
export async function hasConflict(
  staffId: string,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: {
      staffId,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  return count > 0;
}

export type CreateAppointmentInput = {
  businessId: string;
  clientId: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  services: { id: string; name: string; durationMin: number; priceAgorot: number }[];
  totalPriceAgorot: number;
  notes?: string;
  // סטטוס התחלתי: PENDING כברירת מחדל, או CONFIRMED כאשר העסק אינו דורש אישור.
  status?: AppointmentStatus;
};

/** יצירת תור עם שירותים (snapshot) ותזכורת ברירת מחדל. */
export function createAppointment(input: CreateAppointmentInput) {
  const status: AppointmentStatus = input.status ?? 'PENDING';
  return prisma.appointment.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      staffId: input.staffId,
      startAt: input.startAt,
      endAt: input.endAt,
      status,
      confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
      totalPriceAgorot: input.totalPriceAgorot,
      notes: input.notes,
      services: {
        create: input.services.map((s) => ({
          serviceId: s.id,
          nameSnapshot: s.name,
          durationMinSnapshot: s.durationMin,
          priceAgorotSnapshot: s.priceAgorot,
        })),
      },
    },
    include: { services: true, client: true, staff: true },
  });
}

/** עדכון סטטוס תור (אישור/ביטול/בוצע/לא הגיע). */
export function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const data: {
    status: AppointmentStatus;
    confirmedAt?: Date;
    cancelledAt?: Date;
  } = { status };
  if (status === 'CONFIRMED') data.confirmedAt = new Date();
  if (status === 'CANCELLED') data.cancelledAt = new Date();
  return prisma.appointment.update({ where: { id }, data });
}

/** שליפת תור בודד עם כל הפרטים. */
export function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { services: true, client: true, staff: true, reminders: true },
  });
}

/**
 * שליפת תור לצורך ביטול בצד הלקוח: כולל זהות הלקוח (userId/phone) לאימות בעלות,
 * ואת חלון הביטול של העסק לאכיפת המדיניות.
 */
export function getAppointmentForOwner(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startAt: true,
      client: { select: { userId: true, phone: true } },
      business: {
        select: {
          timezone: true,
          settings: { select: { cancellationWindowHours: true } },
        },
      },
    },
  });
}

export type BusinessAppointmentsOptions = {
  statuses?: AppointmentStatus[];
  fromUtc?: Date;
  toUtc?: Date;
  order?: 'asc' | 'desc';
  take?: number;
};

/** שליפת תורי העסק למודול הניהול, עם סינון סטטוס/טווח זמן ומיון. */
export function getBusinessAppointments(
  businessId: string,
  options: BusinessAppointmentsOptions = {},
) {
  const { statuses, fromUtc, toUtc, order = 'asc', take } = options;
  return prisma.appointment.findMany({
    where: {
      businessId,
      ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(fromUtc || toUtc
        ? { startAt: { ...(fromUtc ? { gte: fromUtc } : {}), ...(toUtc ? { lt: toUtc } : {}) } }
        : {}),
    },
    orderBy: { startAt: order },
    ...(take ? { take } : {}),
    include: {
      services: true,
      client: true,
      staff: true,
    },
  });
}
