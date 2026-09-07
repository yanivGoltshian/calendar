import { prisma } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { deliverEmailOnce } from '@/server/billing/emailDelivery';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { emailConfigured, sendReminderEmail } from '@/server/providers/email';
import { normalizePhone } from '@/lib/crypto';
import { BRAND } from '@/config/brand';
import {
  resolveWaitlistNotifyChannel,
  buildWaitlistNotifyEmail,
} from '@/server/repos/waitlistNotify';
import { renderMessage } from '@/server/messages/render';
import type { WaitlistStatus } from '@prisma/client';
import { canSendPaidClientSms, getBusinessAccess } from '@/server/subscription';

/**
 * מודול רשימת המתנה (WaitlistEntry).
 * לוגיקה מעל השדות schema-בלבד שהורחבו: הוספה, צפייה, יידוע ללקוח (דרך ה-SMS stub),
 * קידום ידני וביטול. כל שאילתה מסוננת לפי businessId.
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
  /** אימייל אופציונלי — ערוץ יידוע נוסף ללקוח בחבילות ללא מסרון בתשלום. */
  email?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  clientId?: string | null;
  desiredDate?: string | null;
  /** חלון זמן מועדף — תחילת החלון בדקות מחצות (0–1439). אופציונלי. */
  earliestMinute?: number | null;
  /** חלון זמן מועדף — סוף החלון בדקות מחצות (0–1439). אופציונלי. */
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
      email: data.email?.trim() ? data.email.trim() : null,
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

/** Claim before dispatch; delivery completion cannot overwrite a terminal state. */
export async function notifyWaitlistEntry(
  businessId: string,
  id: string,
  opts?: {
    isExclusive?: boolean;
    sendEmail?: typeof sendReminderEmail;
    sendSms?: typeof sendGuardedSms;
    emailConfigured?: boolean;
  },
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'not_waiting' | 'no_channel' | 'delivery_failed' | 'delivery_in_progress' | 'delivery_unknown' | 'business_inactive' }> {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id, businessId },
    include: { business: true, client: { include: { user: true } } },
  });
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.status !== 'WAITING') return { ok: false, reason: 'not_waiting' };
  if (entry.business.accountStatus !== 'ACTIVE' || !getBusinessAccess(entry.business).active) {
    return { ok: false, reason: 'business_inactive' };
  }
  const channel = resolveWaitlistNotifyChannel({
    isExclusive: canSendPaidClientSms(entry.business) && !!entry.client?.identityVerifiedAt && !!entry.client.user?.phoneVerifiedAt &&
      normalizePhone(entry.client.user.phone ?? '') === normalizePhone(entry.phone),
    email: entry.email,
  });
  if (channel === 'none' || entry.business.plan === 'basic' ||
      (channel === 'email' && !(opts?.emailConfigured ?? emailConfigured))) {
    await prisma.waitlistEntry.updateMany({
      where: { id, businessId, status: 'WAITING', notifyClaimToken: null },
      data: { notifyError: 'no_channel' },
    });
    return { ok: false, reason: 'no_channel' };
  }
  const claimToken = randomUUID();
  const claimed = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: 'WAITING', notifyClaimToken: null },
    data: { notifyClaimToken: claimToken, notifyClaimedAt: new Date(), notifyError: null },
  });
  if (!claimed.count) {
    return { ok: false, reason: entry.notifyClaimedAt && entry.notifyClaimedAt.getTime() < Date.now() - 300000 ? 'delivery_unknown' : 'delivery_in_progress' };
  }
  const vars = {
    clientName: entry.name,
    businessName: entry.business?.name ?? '',
    brand: BRAND.name,
  };
  let delivered = false;
  let uncertain = false;
  let dispatchStarted = false;
  try {
    const stillWaiting = await prisma.waitlistEntry.findFirst({
      where: { id, businessId, status: 'WAITING', notifyClaimToken: claimToken },
    });
    if (!stillWaiting) return { ok: false, reason: 'not_waiting' };
    const liveBusiness = await prisma.business.findUnique({ where: { id: businessId } });
    if (!liveBusiness || liveBusiness.accountStatus !== 'ACTIVE' || !getBusinessAccess(liveBusiness).active) {
      return { ok: false, reason: 'business_inactive' };
    }
    if (channel === 'sms') {
      const fallback = `${BRAND.name}: התפנה תור! ${entry.name}, נשמח לשמור לך מועד. השיבו להודעה זו לתיאום.`;
      const { text: message } = await renderMessage(businessId, 'waitlist_freed', 'sms', vars, { text: fallback });
      dispatchStarted = true;
      const result = await (opts?.sendSms ?? sendGuardedSms)({
        businessId, to: entry.phone, body: message, clientId: entry.clientId,
        channel: 'sms', idempotencyKey: `waitlist:${entry.id}`,
      });
      delivered = result.status === 'sent';
      uncertain = (result.status === 'failed' && result.error === 'delivery_outcome_unknown') ||
        (result.status === 'blocked' && result.reason === 'delivery_outcome_unknown');
    } else if (channel === 'email' && entry.email) {
      const fb = buildWaitlistNotifyEmail(entry.name);
      const { subject, text, html } = await renderMessage(businessId, 'waitlist_freed', 'email', vars, fb);
      const transport = opts?.sendEmail;
      dispatchStarted = true;
      const result = await deliverEmailOnce({
        businessId, clientId: entry.clientId, idempotencyKey: `waitlist:${entry.id}`,
        to: entry.email, subject: subject ?? fb.subject, text, html: html ?? fb.html,
      }, {
        send: transport ? (to, subject, text, html) => transport(to, subject, text, html ?? '') : undefined,
        configured: opts?.emailConfigured,
      });
      delivered = result.status === 'sent';
      uncertain = result.status === 'unknown';
    }
    if (!delivered) return { ok: false, reason: uncertain ? 'delivery_unknown' : 'delivery_failed' };
    const finalized = await prisma.waitlistEntry.updateMany({
      where: { id: entry.id, businessId, status: 'WAITING', notifyClaimToken: claimToken },
      data: { status: 'NOTIFIED', notifiedAt: new Date(), notifyClaimToken: null, notifyClaimedAt: null, notifyError: null },
    });
    return finalized.count ? { ok: true } : { ok: false, reason: 'not_waiting' };
  } catch (error) {
    // Accepted sends with failed persistence and network timeouts are ambiguous.
    uncertain = delivered || (dispatchStarted && !['EAUTH', 'EENVELOPE', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND']
      .includes((error as NodeJS.ErrnoException)?.code ?? ''));
    return { ok: false, reason: uncertain ? 'delivery_unknown' : 'delivery_failed' };
  } finally {
    if (!delivered) {
      await prisma.waitlistEntry.updateMany({
        where: { id, businessId, status: 'WAITING', notifyClaimToken: claimToken },
        data: uncertain ? { notifyError: 'delivery_outcome_unknown' }
          : { notifyClaimToken: null, notifyClaimedAt: null, notifyError: 'delivery_failed' },
      }).catch(() => undefined);
    }
  }
}

/** קידום ידני (הוזמן): מסמן BOOKED עם promotedAt. פועל על WAITING או NOTIFIED. */
export async function promoteWaitlistEntry(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'BOOKED', promotedAt: new Date(), notifyClaimToken: null, notifyClaimedAt: null },
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
    data: { status: 'CANCELLED', notifyClaimToken: null, notifyClaimedAt: null },
  });
  return result.count > 0;
}
