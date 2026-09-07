import { prisma } from '@/lib/db';

/**
 * שליפות עבור אזור החשבון של הלקוח (/account).
 *
 * Appointment authority is an explicitly verified user link. Contact fields,
 * including contacts stored before this migration, never grant appointment access.
 */

export type UserIdentity = {
  userId: string;
  phone?: string;
  email?: string;
};

/** שליפת תורי הלקוח, מחולקים לעתידיים והיסטוריים, עם שירותים, צוות ועסק. */
export async function getAppointmentsForUser(identity: UserIdentity) {
  if (!identity.userId) return { upcoming: [], past: [] };

  const appointments = await prisma.appointment.findMany({
    where: {
      client: { userId: identity.userId, identityVerifiedAt: { not: null } },
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
          address: true,
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

/**
 * תורים עתידיים של הלקוח בעסק מסוים בלבד (למקטע "שלום .." בעמוד העסק הציבורי).
 * Only verified userId links are accepted; guest contacts are not identity.
 * מוחזרים רק תורים שטרם התחילו ושאינם מבוטלים, ממוינים מהקרוב לרחוק.
 */
export async function getUpcomingAppointmentsForUserAtBusiness(
  identity: UserIdentity,
  businessId: string,
) {
  if (!identity.userId) return [];

  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startAt: { gte: now },
      status: { in: ['PENDING', 'CONFIRMED'] },
      client: { userId: identity.userId, identityVerifiedAt: { not: null } },
    },
    include: {
      services: { select: { nameSnapshot: true, durationMinSnapshot: true } },
      staff: { select: { displayName: true } },
      business: {
        select: {
          name: true,
          timezone: true,
          address: true,
          settings: { select: { cancellationWindowHours: true } },
        },
      },
    },
    orderBy: { startAt: 'asc' },
  });

  return appointments;
}

/**
 * מידע לצורך מחיקת חשבון: כמה עסקים בבעלות המשתמש וכמה שיוכי-צוות יש לו.
 * חשבון שהוא בעל עסק או איש צוות אינו נמחק אוטומטית (הגנה על נתוני העסק).
 */
export async function getAccountDeletionInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      _count: { select: { ownedBusinesses: true, staffMemberships: true } },
    },
  });
  if (!user) return null;
  return {
    ownedBusinesses: user._count.ownedBusinesses,
    staffMemberships: user._count.staffMemberships,
  };
}

/**
 * מחיקת רישום המשתמש שלנו (זהות ההתחברות + פרטי הזיהוי).
 * לפי הסכימה: פרופילי לקוח מנותקים (Client.userId → SetNull) כך שתורים שכבר
 * נקבעו נשמרים אצל בעלי העסקים, אך מנותקים מהזהות האישית.
 */
export async function deleteUserAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
