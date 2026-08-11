import { prisma } from '@/lib/db';
import type { AppointmentStatus } from '@prisma/client';

/**
 * מודול סטטיסטיקות (stats) — קריאה בלבד.
 * צובר מדדי מפתח מתוך התורים/לקוחות בטווח תאריכים נתון. אינו משנה שום לוגיקה קיימת.
 */

/** סדר הצגה קבוע לסטטוסי התורים בדשבורד. */
export const STATUS_ORDER: AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
];

export type StatsSummary = {
  totalAppointments: number;
  byStatus: { status: AppointmentStatus; count: number }[];
  revenueAgorot: number; // הכנסה משוערת: סכום תורים שהושלמו (DONE)
  newClients: number;
  topServices: { name: string; count: number; revenueAgorot: number }[];
  byStaff: { name: string; count: number }[];
};

/**
 * חישוב סיכום סטטיסטי לטווח [fromUtc, toUtc).
 * מושך את התורים בטווח פעם אחת (כולל שירותים וצוות) וצובר ב-JS.
 */
export async function getStatsSummary(
  businessId: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<StatsSummary> {
  const [appointments, newClients] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId, startAt: { gte: fromUtc, lt: toUtc } },
      select: {
        status: true,
        totalPriceAgorot: true,
        staff: { select: { displayName: true } },
        services: { select: { nameSnapshot: true, priceAgorotSnapshot: true } },
      },
    }),
    prisma.client.count({
      where: { businessId, createdAt: { gte: fromUtc, lt: toUtc } },
    }),
  ]);

  const statusCounts = new Map<AppointmentStatus, number>();
  const serviceAgg = new Map<string, { count: number; revenueAgorot: number }>();
  const staffAgg = new Map<string, number>();
  let revenueAgorot = 0;

  for (const appt of appointments) {
    statusCounts.set(appt.status, (statusCounts.get(appt.status) ?? 0) + 1);

    if (appt.status === 'DONE') revenueAgorot += appt.totalPriceAgorot;

    // פילוח שירותים ומחזור לפי צוות נספרים על תורים שלא בוטלו.
    if (appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW') {
      const staffName = appt.staff?.displayName ?? '—';
      staffAgg.set(staffName, (staffAgg.get(staffName) ?? 0) + 1);

      for (const svc of appt.services) {
        const prev = serviceAgg.get(svc.nameSnapshot) ?? { count: 0, revenueAgorot: 0 };
        prev.count += 1;
        prev.revenueAgorot += svc.priceAgorotSnapshot;
        serviceAgg.set(svc.nameSnapshot, prev);
      }
    }
  }

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const topServices = [...serviceAgg.entries()]
    .map(([name, v]) => ({ name, count: v.count, revenueAgorot: v.revenueAgorot }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byStaff = [...staffAgg.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAppointments: appointments.length,
    byStatus,
    revenueAgorot,
    newClients,
    topServices,
    byStaff,
  };
}
