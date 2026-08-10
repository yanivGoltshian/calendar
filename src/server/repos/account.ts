import { prisma } from '@/lib/db';

/**
 * שליפות עבור אזור החשבון של הלקוח (/account).
 *
 * זהות הלקוח נקבעת לפי מזהה המשתמש (userId) או לפי הטלפון (phone) — שהוא מזהה
 * גלובלי ייחודי. כך תורים שנקבעו לפני שהמשתמש התחבר (לפי טלפון בלבד) עדיין
 * משויכים אליו.
 */

export type UserIdentity = {
  userId: string;
  phone: string;
};

/** שליפת תורי הלקוח, מחולקים לעתידיים והיסטוריים, עם שירותים, צוות ועסק. */
export async function getAppointmentsForUser(identity: UserIdentity) {
  const appointments = await prisma.appointment.findMany({
    where: {
      client: {
        OR: [{ userId: identity.userId }, { phone: identity.phone }],
      },
    },
    include: {
      services: true,
      staff: true,
      business: { select: { id: true, name: true, slug: true, timezone: true } },
    },
    orderBy: { startAt: 'desc' },
  });

  const now = Date.now();
  const upcoming = appointments
    .filter((a) => a.startAt.getTime() >= now && a.status !== 'CANCELLED')
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = appointments.filter(
    (a) => a.startAt.getTime() < now || a.status === 'CANCELLED',
  );

  return { upcoming, past };
}
