import { prisma } from '@/lib/db';
import type { AppointmentStatus, ConfirmationStatus, Prisma } from '@prisma/client';
import {
  assertBookable,
  BookingError,
  expirePendingReservations,
} from '@/server/booking/policy';
import { bookingTransaction } from '@/server/booking/transaction';
import { reserveBookingQuota } from '@/server/booking/quotas';
import { findOrCreateClient } from '@/server/repos/clients';
import { schedulesReminders } from '@/server/tier';
import { captureGoogleBusy, assertGoogleBusySnapshot } from '@/server/google/importBusy';

// סטטוסים שתופסים משבצת זמן ולכן חוסמים זמינות.
const BLOCKING_STATUSES: AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
];

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
export function getAppointmentsForStaffRange(
  staffId: string,
  fromUtc: Date,
  toUtc: Date,
) {
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

/** ספירת תורים הממתינים לאישור (PENDING) לעסק — לחיווי ההתראה באזור הניהול. */
export async function countPendingAppointments(businessId: string): Promise<number> {
  return prisma.appointment.count({
    where: { businessId, status: 'PENDING' },
  });
}

/**
 * מספר התורים של העסק בטווח זמן (UTC), למעט מבוטלים — לכרטיס "תורים היום" בלוח הבקרה.
 * עקבי עם getAppointmentsForBusinessRange שמסנן גם הוא CANCELLED.
 */
export async function countAppointmentsInRange(
  businessId: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<number> {
  return prisma.appointment.count({
    where: {
      businessId,
      startAt: { gte: fromUtc, lt: toUtc },
      status: { not: 'CANCELLED' },
    },
  });
}

/**
 * סכום ההכנסה (באגורות) מכל התורים בטווח זמן (UTC), למעט מבוטלים — להכנסה החודשית
 * המצטברת בלוח הבקרה. מסכם totalPriceAgorot של כל תור שלא בוטל בטווח.
 */
export async function sumRevenueAgorotInRange(
  businessId: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<number> {
  const agg = await prisma.appointment.aggregate({
    where: {
      businessId,
      startAt: { gte: fromUtc, lt: toUtc },
      status: { not: 'CANCELLED' },
    },
    _sum: { totalPriceAgorot: true },
  });
  return agg._sum.totalPriceAgorot ?? 0;
}

export type CreateAppointmentInput = {
  businessId: string;
  clientId?: string;
  clientIdentity?: { name: string; phone?: string; email?: string; userId?: string };
  idempotency?: { scope: string; key: string; requestHash: string };
  source?: string;
  publicBooking?: boolean;
  staffId: string;
  startAt: Date;
  endAt: Date;
  services: { id: string; name: string; durationMin: number; priceAgorot: number }[];
  totalPriceAgorot: number;
  notes?: string;
  // סטטוס התחלתי: PENDING כברירת מחדל, או CONFIRMED כאשר העסק אינו דורש אישור.
  status?: AppointmentStatus;
};

async function bookingReplay(input: CreateAppointmentInput, db: Prisma.TransactionClient = prisma) {
  if (!input.idempotency) return null;
  const existing = await db.appointment.findUnique({
    where: { bookingScope_bookingKey: { bookingScope: input.idempotency.scope, bookingKey: input.idempotency.key } },
    include: { services: true, client: true, staff: true },
  });
  if (!existing) return null;
  if (existing.bookingRequestHash !== input.idempotency.requestHash)
    throw new BookingError('idempotency_mismatch', 409);
  return { ...existing, replayed: true };
}

/** יצירת תור עם שירותים (snapshot) ותזכורת ברירת מחדל. */
export async function createAppointment(input: CreateAppointmentInput) {
  const replay = await bookingReplay(input);
  if (replay) return replay;
  if (!Number.isFinite(input.startAt.getTime())) throw new BookingError('invalid_time');
  const calendar = await captureGoogleBusy(input.businessId, input.staffId,
    input.startAt, new Date(input.startAt.getTime() + 86_400_000));
  return bookingTransaction(async (db) => {
    const now = new Date();
    const replay = await bookingReplay(input, db);
    if (replay) return replay;
    await expirePendingReservations(input.businessId, db, now);
    const policy = await assertBookable(
      {
        businessId: input.businessId,
        staffId: input.staffId,
        serviceIds: input.services.map((service) => service.id),
        startAt: input.startAt,
      },
      db,
      now,
    );
    await assertGoogleBusySnapshot(calendar, db, input.startAt, policy.endAt);
    const client = input.clientIdentity
      ? await findOrCreateClient(
          { businessId: input.businessId, ...input.clientIdentity },
          db,
        )
      : input.clientId
        ? await db.client.findFirst({
            where: { id: input.clientId, businessId: input.businessId },
          })
        : null;
    if (!client || client.blocked) throw new BookingError('invalid_client', 403);
    if (input.publicBooking) {
      await reserveBookingQuota(
        db,
        { businessId: input.businessId, ...input.clientIdentity, source: input.source },
        now,
      );
    }
    const status =
      input.status ??
      (policy.business.settings?.bookingRequiresApproval ? 'PENDING' : 'CONFIRMED');
    if (status !== 'PENDING' && status !== 'CONFIRMED')
      throw new BookingError('invalid_status');
    const reminderEnabled =
      schedulesReminders(policy.business.plan) &&
      (policy.business.settings?.remindersEnabled ?? true);
    const sendAt = new Date(
      Math.max(
        input.startAt.getTime() -
          (policy.business.settings?.reminderLeadHours ?? 24) * 3_600_000,
        now.getTime() + 60_000,
      ),
    );
    const appointment = await db.appointment.create({
      data: {
        businessId: input.businessId,
        clientId: client.id,
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: policy.endAt,
        status,
        confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
        googleSyncPending: status === 'CONFIRMED',
        totalPriceAgorot: policy.services.reduce(
          (sum, service) => sum + service.priceAgorot,
          0,
        ),
        notes: input.notes,
        bookingScope: input.idempotency?.scope,
        bookingKey: input.idempotency?.key,
        bookingRequestHash: input.idempotency?.requestHash,
        pendingExpiresAt:
          input.publicBooking && status === 'PENDING'
            ? new Date(Math.min(now.getTime() + 86_400_000, input.startAt.getTime()))
            : null,
        reminders: reminderEnabled ? { create: { sendAt, channel: 'AUTO' } } : undefined,
        services: {
          create: policy.services.map((s) => ({
            serviceId: s.id,
            nameSnapshot: s.name,
            durationMinSnapshot: s.durationMin,
            priceAgorotSnapshot: s.priceAgorot,
          })),
        },
      },
      include: { services: true, client: true, staff: true },
    });
    return { ...appointment, replayed: false };
  });
}

/** מי יזם ביטול תור: הלקוח מהעמוד הציבורי, או בעל העסק במודול הניהול. */
export type CancellationActor = 'CLIENT' | 'OWNER';

/**
 * עדכון סטטוס תור (אישור/ביטול/בוצע/לא הגיע).
 * בביטול מסומן גם מי יזם אותו (cancelledBy) — ברירת המחדל 'OWNER' (פעולת ניהול),
 * ונתיב הלקוח מעביר במפורש 'CLIENT'. משמש להתראת בעל העסק על ביטולי לקוח בלבד.
 */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  opts: {
    cancelledBy?: CancellationActor;
    businessId: string;
    clientUserId?: string;
    expectedStatus?: AppointmentStatus;
  },
) {
  const where = {
    id,
    businessId: opts.businessId,
    ...(opts.clientUserId
      ? { client: { userId: opts.clientUserId, identityVerifiedAt: { not: null } } }
      : {}),
  };
  const reservation = status === 'CONFIRMED'
    ? await prisma.appointment.findFirst({ where, select: { staffId: true, startAt: true, endAt: true, status: true } })
    : null;
  const calendar = reservation?.status === 'PENDING'
    ? await captureGoogleBusy(opts.businessId, reservation.staffId, reservation.startAt,
        new Date(reservation.startAt.getTime() + 86_400_000))
    : null;
  return bookingTransaction(async (db) => {
    const existing = await db.appointment.findFirst({
      where,
      include: { services: true, business: { include: { settings: true } } },
    });
    if (!existing) throw new BookingError('forbidden', 403);
    if (opts.expectedStatus && existing.status !== opts.expectedStatus) return null;
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW', 'DONE'],
      ARRIVED: ['DONE', 'NO_SHOW'],
      CANCELLED: [],
      DONE: [],
      NO_SHOW: [],
    };
    if (!allowed[existing.status].includes(status)) return null;
    const now = new Date();
    if (opts.cancelledBy === 'CLIENT') {
      if (!opts.clientUserId || !['PENDING', 'CONFIRMED'].includes(existing.status))
        return null;
      const cutoff =
        existing.startAt.getTime() -
        (existing.business.settings?.cancellationWindowHours ?? 0) * 3_600_000;
      if (now.getTime() >= cutoff) throw new BookingError('window_passed');
    }
    if (status === 'CONFIRMED') {
      if (existing.pendingExpiresAt && existing.pendingExpiresAt <= now) return null;
      const policy = await assertBookable(
        {
          businessId: existing.businessId,
          staffId: existing.staffId,
          serviceIds: existing.services.map((service) => service.serviceId),
          startAt: existing.startAt,
        },
        db,
        now,
        id,
      );
      if (policy.endAt.getTime() !== existing.endAt.getTime()) {
        throw new BookingError('booking_changed', 409);
      }
      if (!calendar) throw new BookingError('calendar_snapshot_stale', 503);
      await assertGoogleBusySnapshot(calendar, db, existing.startAt, existing.endAt);
    }
    const data: {
      status: AppointmentStatus;
      confirmedAt?: Date;
      cancelledAt?: Date;
      cancelledBy?: CancellationActor;
      googleSyncPending?: boolean;
    } = { status };
    if (status === 'CONFIRMED') data.confirmedAt = now;
    if (status === 'CONFIRMED' || status === 'CANCELLED') data.googleSyncPending = true;
    if (status === 'CANCELLED') {
      data.cancelledAt = now;
      data.cancelledBy = opts?.cancelledBy ?? 'OWNER';
    }
    const updated = await db.appointment.update({ where: { id }, data });
    if (status === 'CANCELLED') {
      await db.reminder.updateMany({
        where: { appointmentId: id, status: { in: ['SCHEDULED', 'FAILED'] } },
        data: { status: 'CANCELLED' },
      });
    }
    return updated;
  });
}

/**
 * ספירת ביטולי לקוח עדכניים לתורים עתידיים בעסק — להתראת הפעמון.
 * חלון מתגלגל: תורים שסטטוסם CANCELLED, שבוטלו בידי הלקוח (cancelledBy='CLIENT')
 * מאז הרגע `since`, ושמועדם עדיין עתידי (slot שהתפנה). מתאפס מעצמו כשהחלון עובר.
 */
export function countRecentClientCancellations(
  businessId: string,
  since: Date,
  now: Date = new Date(),
): Promise<number> {
  return prisma.appointment.count({
    where: {
      businessId,
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelledAt: { gte: since },
      startAt: { gt: now },
    },
  });
}

/**
 * ספירת הזמנות מאושרות עדכניות לתורים עתידיים בעסק — להתראת הפעמון.
 * חלון מתגלגל: תורים שסטטוסם CONFIRMED (כולל אישור אוטומטי), שנוצרו מאז הרגע
 * `since`, ושמועדם עדיין עתידי. תורים הממתינים לאישור (PENDING) אינם נספרים כאן
 * כי הם כבר מיוצגים בפריט "ממתינים לאישור", וכך נמנעת ספירה כפולה. מתאפס מעצמו
 * כשהחלון עובר, בדיוק כמו countRecentClientCancellations.
 */
export function countRecentBookings(
  businessId: string,
  since: Date,
  now: Date = new Date(),
): Promise<number> {
  return prisma.appointment.count({
    where: {
      businessId,
      status: 'CONFIRMED',
      createdAt: { gte: since },
      startAt: { gt: now },
    },
  });
}

/** שליפת תור בודד עם כל הפרטים. */
export function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { services: true, client: true, staff: true, reminders: true },
  });
}

/**
 * עדכון מזהה אירוע יומן Google על תור (מודול סנכרון יומן). מקבל מזהה או null
 * (איפוס לאחר מחיקה). אדיטיבי ובטוח; משמש את מודול הייצוא בלבד.
 */
export function setGoogleCalendarEventId(id: string, eventId: string | null) {
  return prisma.appointment.update({
    where: { id },
    data: { googleCalendarEventId: eventId },
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
      client: {
        select: { userId: true, identityVerifiedAt: true, phone: true, name: true },
      },
      services: { select: { nameSnapshot: true } },
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          ownerEmail: true,
          owner: { select: { email: true } },
          settings: {
            select: {
              cancellationWindowHours: true,
              notifyOnCancellation: true,
              pushEnabled: true,
            },
          },
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
        ? {
            startAt: {
              ...(fromUtc ? { gte: fromUtc } : {}),
              ...(toUtc ? { lt: toUtc } : {}),
            },
          }
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

// ─── מודול תזכורות 24 שעות ואישור הגעה ───────────────────────────────────────

// סטטוסים פעילים שרלוונטיים לתזכורת (תור שעדיין אמור להתקיים).
const REMINDABLE_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

// בחירת שדות אחידה לתצוגת קישור האישור וההודעה — שם עסק, זהות לקוח (טלפון ומייל),
// תצורת התזכורות של העסק (מתוך ה-relation settings, שהוא nullable), צוות ושירותים.
// המייל וערוץ התזכורת דרושים לגזירת הערוץ בפועל בשכבת השליחה (resolveReminderChannel).
// remindersEnabled/reminderLeadHours/confirmationRequired מחווטים במסלול השליחה:
// remindersEnabled משמש כשער opt-out בשאילתה למטה, reminderLeadHours קובע מתי התור
// בשל לתזכורת (חישוב פר-תור במטפל ה-cron), ו-confirmationRequired קובע אם ההודעה
// כוללת את קישור האישור /c/<token> (נגזר ב-buildReminderBody/buildReminderEmail).
// שדות החבילה (plan/subscriptionStatus/trialEndsAt/paidUntil) דרושים לחישוב
// canSendPaidClientSms — האם מותר לשלוח מסרון בתשלום ללקוח (אקסקלוסיב פעיל בלבד).
const reminderInclude = {
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      timezone: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      paidUntil: true,
      settings: {
        select: {
          reminderChannel: true,
          remindersEnabled: true,
          reminderLeadHours: true,
          confirmationRequired: true,
        },
      },
    },
  },
  client: { select: { id: true, name: true, phone: true, email: true } },
  staff: { select: { id: true, displayName: true, title: true } },
  services: { select: { nameSnapshot: true } },
} as const;

/**
 * תורים בטווח השליפה (windowStart..windowEnd ב-UTC) שטרם נשלחה עבורם תזכורת.
 * הטווח מחושב אצל הקורא כחלון מרבי חסום (עד זמן ההקדמה הגדול ביותר האפשרי);
 * המטפל ב-cron מסנן פר-תור לפי reminderLeadHours של כל עסק כדי לקבוע בשלות.
 * מסנן לפי reminderSentAt ריק וסטטוס פעיל, כדי שהריצה תהיה אידמפוטנטית.
 *
 * שער opt-out עסקי: נכללים רק תורים של עסק שהתזכורות מופעלות אצלו — או שאין לו
 * כלל שורת settings (null ⇒ ברירת מחדל true), או ש-remindersEnabled=true. עסק
 * שכיבה במפורש את התזכורות (remindersEnabled=false) מסונן כאן ולא נשלף. שער זה
 * הוא נוסף מעל שער החבילה (schedulesReminders) — שניהם צריכים להתקיים כדי לשלוח.
 */
export function getAppointmentsDueForReminder(windowStart: Date, windowEnd: Date) {
  return prisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      status: { in: REMINDABLE_STATUSES },
      startAt: { gte: windowStart, lte: windowEnd },
      business: {
        OR: [
          { settings: { is: null } },
          { settings: { is: { remindersEnabled: true } } },
        ],
      },
    },
    orderBy: { startAt: 'asc' },
    include: reminderInclude,
  });
}

/** שליפת תור בודד לפי טוקן האישור הציבורי — לעמוד /c/<token>. */
export function getAppointmentByConfirmToken(token: string) {
  return prisma.appointment.findUnique({
    where: { confirmToken: token },
    include: reminderInclude,
  });
}

/**
 * סימון שנשלחה תזכורת, באופן אטומי ואידמפוטנטי: מעדכן רק אם reminderSentAt עדיין ריק.
 * מחזיר את מספר השורות שעודכנו (0 אם כבר סומן במקביל), למניעת שליחה כפולה.
 */
export async function markReminderSent(
  id: string,
  sentAt: Date = new Date(),
): Promise<number> {
  const result = await prisma.appointment.updateMany({
    where: { id, reminderSentAt: null },
    data: { reminderSentAt: sentAt },
  });
  return result.count;
}

/**
 * עדכון אישור ההגעה מצד הלקוח לפי טוקן. מחזיר את התור המעודכן, או null אם הטוקן לא נמצא.
 */
export async function setConfirmationStatusByToken(
  token: string,
  status: ConfirmationStatus,
) {
  const existing = await prisma.appointment.findUnique({
    where: { confirmToken: token },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.appointment.update({
    where: { confirmToken: token },
    data: { confirmationStatus: status },
    include: reminderInclude,
  });
}
