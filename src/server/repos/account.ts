import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * שליפות עבור אזור החשבון של הלקוח (/account).
 *
 * זהות הלקוח נקבעת לפי מזהה המשתמש (userId), הטלפון (phone) או המייל (email) —
 * כולם מזהים גלובליים ייחודיים. כך תורים שנקבעו לפני שהמשתמש התחבר (לפי טלפון
 * או מייל בלבד) עדיין משויכים אליו.
 */

export type UserIdentity = {
  userId: string;
  phone?: string;
  email?: string;
};

/** שליפת תורי הלקוח, מחולקים לעתידיים והיסטוריים, עם שירותים, צוות ועסק. */
export async function getAppointmentsForUser(identity: UserIdentity) {
  const clientOr: Prisma.ClientWhereInput[] = [{ userId: identity.userId }];
  if (identity.phone) clientOr.push({ phone: identity.phone });
  if (identity.email) clientOr.push({ email: identity.email });

  const appointments = await prisma.appointment.findMany({
    where: {
      client: {
        OR: clientOr,
      },
    },
    include: {
      services: true,
      staff: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          settings: { select: { cancellationWindowHours: true } },
        },
      },
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
