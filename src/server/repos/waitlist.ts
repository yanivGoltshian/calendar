import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/crypto';
import type { WaitlistStatus } from '@prisma/client';
import type { WaitlistCandidate } from '@/server/waitlist/match';

/**
 * מודול רשימת המתנה (WaitlistEntry) — פרימיטיבים ל-DB בלבד.
 * מעל השדות שהורחבו בסכימה: הוספה, צפייה, החזקה בלעדית (hold) לקישור תפיסה,
 * תפיסה (claim), פקיעה, קידום ידני וביטול. כל שאילתה מסוננת לפי businessId.
 *
 * חשוב: כאן אין שליחת הודעות — האורקסטרציה והשליחה (WhatsApp/מייל, מאחורי דגל
 * התכונה) יושבות ב-src/server/waitlist/autofill.ts כדי לשמור על שכבת DB טהורה
 * ולמנוע תלות מעגלית מול שכבת הספקים.
 */

/** רשימת ממתינים בעסק (אופציונלית לפי סטטוס), עם שירות/צוות/לקוח. סדר לפי ותק. */
export function listWaitlist(businessId: string, status?: WaitlistStatus) {
  return prisma.waitlistEntry.findMany({
    where: { businessId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      service: { select: { id: true, name: true } },
      staff: { select: { id: true, displayName: true } },
      client: { select: { id: true, name: true } },
    },
  });
}

export type AddWaitlistInput = {
  name: string;
  phone: string;
  serviceId?: string | null;
  staffId?: string | null;
  clientId?: string | null;
  desiredDate?: string | null;
  earliestMinute?: number | null;
  latestMinute?: number | null;
  note?: string | null;
};

/** הוספת ממתין חדש לרשימה. מנרמל טלפון ומאמת שיוך שירות/צוות/לקוח לעסק. */
export async function addWaitlistEntry(
  businessId: string,
  data: AddWaitlistInput,
): Promise<{ ok: true; id: string }> {
  let serviceId: string | null = null;
  if (data.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
      select: { id: true },
    });
    serviceId = service?.id ?? null;
  }

  let staffId: string | null = null;
  if (data.staffId) {
    const staff = await prisma.staffMember.findFirst({
      where: { id: data.staffId, businessId },
      select: { id: true },
    });
    staffId = staff?.id ?? null;
  }

  let clientId: string | null = null;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, businessId },
      select: { id: true },
    });
    clientId = client?.id ?? null;
  }

  const created = await prisma.waitlistEntry.create({
    data: {
      businessId,
      name: data.name,
      phone: normalizePhone(data.phone),
      serviceId,
      staffId,
      clientId,
      desiredDate: data.desiredDate ?? null,
      earliestMinute: data.earliestMinute ?? null,
      latestMinute: data.latestMinute ?? null,
      note: data.note ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/**
 * כל הממתינים הכשירים (WAITING) בעסק, מצומצמים לשדות הדרושים ללוגיקת ההתאמה.
 * הסדר לפי ותק (createdAt עולה) כדי לשמר first-come כבר בשלב הטעינה.
 */
export function findWaitingCandidatesForBusiness(
  businessId: string,
): Promise<WaitlistCandidate[]> {
  return prisma.waitlistEntry.findMany({
    where: { businessId, status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      serviceId: true,
      staffId: true,
      desiredDate: true,
      earliestMinute: true,
      latestMinute: true,
      status: true,
      createdAt: true,
    },
  });
}

/** רשומת ממתין בודדת בעסק, עם פרטי קשר של הלקוח המקושר (למקרה יידוע ידני). */
export function getWaitlistEntryForBusiness(businessId: string, id: string) {
  return prisma.waitlistEntry.findFirst({
    where: { id, businessId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      service: { select: { id: true, name: true } },
      staff: { select: { id: true, displayName: true } },
    },
  });
}

export type HoldEntryInput = {
  claimToken: string;
  holdExpiresAt: Date;
  heldAppointmentId: string | null;
};

/**
 * קביעת "החזקה" בלעדית על רשומת ממתין: WAITING → NOTIFIED עם טוקן תפיסה, מועד
 * פקיעה ומזהה התור שממנו נגזרה המשבצת. אטומי (updateMany עם משמר status=WAITING)
 * כך ששני טריגרים מקבילים לא יתפסו את אותה רשומה. מחזיר true אם ההחזקה נקבעה.
 */
export async function setHoldForEntry(
  entryId: string,
  input: HoldEntryInput,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, status: 'WAITING' },
    data: {
      status: 'NOTIFIED',
      notifiedAt: new Date(),
      claimToken: input.claimToken,
      holdExpiresAt: input.holdExpiresAt,
      heldAppointmentId: input.heldAppointmentId,
    },
  });
  return result.count > 0;
}

/** שליפת רשומת ממתין לפי טוקן התפיסה, עם פרטי העסק/השירות/הצוות/הלקוח. */
export function getEntryByClaimToken(token: string) {
  return prisma.waitlistEntry.findFirst({
    where: { claimToken: token },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          settings: { select: { remindersEnabled: true, reminderChannel: true } },
        },
      },
      service: { select: { id: true, name: true } },
      staff: { select: { id: true, displayName: true } },
      client: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

/**
 * תפיסת המשבצת המוחזקת (first-come): NOTIFIED → BOOKED, בתנאי שההחזקה בתוקף
 * (holdExpiresAt עדיין בעתיד). אטומי, כך שרק התופס הראשון מצליח. מחזיר true בהצלחה.
 */
export async function claimHeldEntry(token: string): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { claimToken: token, status: 'NOTIFIED', holdExpiresAt: { gt: new Date() } },
    data: { status: 'BOOKED', promotedAt: new Date() },
  });
  return result.count > 0;
}

/** ההחזקות שפג תוקפן: NOTIFIED עם holdExpiresAt בעבר (לשֶׁווֹפ הפקיעה). */
export function findExpiredHolds(
  now: Date = new Date(),
): Promise<{ id: string; businessId: string; heldAppointmentId: string | null }[]> {
  return prisma.waitlistEntry.findMany({
    where: { status: 'NOTIFIED', holdExpiresAt: { lt: now } },
    select: { id: true, businessId: true, heldAppointmentId: true },
  });
}

/** סימון החזקה שפגה כ-EXPIRED (אטומי, רק אם עדיין NOTIFIED). מחזיר true אם עודכן. */
export async function expireHeldEntry(entryId: string): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, status: 'NOTIFIED' },
    data: { status: 'EXPIRED' },
  });
  return result.count > 0;
}

/**
 * יידוע ידני (ללא תור ספציפי שהתפנה) מאזור הניהול: WAITING → NOTIFIED עם notifiedAt,
 * ללא טוקן/החזקה. משמש כשהעסק מודיע ידנית שהתפנה מקום. מחזיר true אם עודכן.
 */
export async function markWaitlistNotified(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: 'WAITING' },
    data: { status: 'NOTIFIED', notifiedAt: new Date() },
  });
  return result.count > 0;
}

/** קידום ידני (הוזמן): מסמן BOOKED עם promotedAt. פועל על WAITING או NOTIFIED. */
export async function promoteWaitlistEntry(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'BOOKED', promotedAt: new Date() },
  });
  return result.count > 0;
}

/** ביטול רשומה מרשימת ההמתנה (CANCELLED). */
export async function cancelWaitlistEntry(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'CANCELLED' },
  });
  return result.count > 0;
}
