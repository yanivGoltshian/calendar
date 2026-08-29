import { prisma } from '@/lib/db';
import { sendGuardedSms as defaultSendGuardedSms } from '@/server/billing/costGuard';
import {
  allowedCampaignChannels,
  resolveCampaignRecipients,
  type CampaignChannel,
} from '@/server/campaigns/channels';
import { deliverCampaignMessage } from '@/server/campaigns/delivery';
import { canSendPaidClientSms } from '@/server/subscription';

/**
 * מודול דיוור רב-ערוצי (marketing).
 * קמפיין מפולח ללקוחות: הפילוח מחושב בזמן שליחה (קריאה בלבד ממודל הלקוחות/תורים),
 * השליחה נעשית דרך שכבת המסירה הרב-ערוצית (מייל / SMS / וואטסאפ) לפי הערוצים שנבחרו,
 * וכל נמען נרשם ב-MessageLog. במצב פיתוח (ללא תצורת ספק חי) ההודעות נכתבות ליומן בלבד.
 */

export type CampaignSegment = 'all' | 'active' | 'with_appointments';

export const CAMPAIGN_SEGMENTS: CampaignSegment[] = ['all', 'active', 'with_appointments'];

export function normalizeSegment(value: string | null | undefined): CampaignSegment {
  return value === 'active' || value === 'with_appointments' ? value : 'all';
}

/** בניית תנאי הפילוח לשאילתת לקוחות. קריאה בלבד — אינה משנה לוגיקת לקוחות. */
function segmentWhere(businessId: string, segment: CampaignSegment) {
  const where: {
    businessId: string;
    blocked?: boolean;
    appointments?: { some: Record<string, never> };
  } = { businessId };
  if (segment === 'active') where.blocked = false;
  else if (segment === 'with_appointments') where.appointments = { some: {} };
  return where;
}

/** רשימת לקוחות (טלפון + מייל) התואמים לפילוח — לחישוב נמענים ולשליחה רב-ערוצית. */
export function resolveSegmentClients(businessId: string, segment: CampaignSegment) {
  return prisma.client.findMany({
    where: segmentWhere(businessId, segment),
    select: { id: true, name: true, phone: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** ספירת נמענים לפילוח (תצוגה מקדימה בטופס). */
export function countSegment(businessId: string, segment: CampaignSegment) {
  return prisma.client.count({ where: segmentWhere(businessId, segment) });
}

/** רשימת הקמפיינים של העסק, עם ספירת הודעות בפועל. */
export function listCampaigns(businessId: string) {
  return prisma.campaign.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });
}

/** קמפיין בודד בתוך העסק, כולל יומן ההודעות. */
export function getCampaign(businessId: string, id: string) {
  return prisma.campaign.findFirst({
    where: { id, businessId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { client: { select: { name: true } } },
      },
    },
  });
}

export type CreateCampaignInput = {
  name: string;
  body: string;
  segment: CampaignSegment;
  /** ערוצי המסירה שנבחרו (מייל / SMS / וואטסאפ). ריק => נפילה לאחור ל-sms בשליחה. */
  channels?: CampaignChannel[];
  /** זמן שליחה מתוזמן (UTC). כאשר קיים — הקמפיין נוצר במצב SCHEDULED. */
  scheduledAt?: Date | null;
};

/**
 * יצירת קמפיין חדש. ברירת מחדל — טיוטה (DRAFT) לשליחה ידנית. אם סופק scheduledAt,
 * הקמפיין נוצר במצב מתוזמן (SCHEDULED) ויישלח על ידי ה-cron כשיגיע זמנו.
 */
export function createCampaign(businessId: string, data: CreateCampaignInput) {
  const scheduled = data.scheduledAt != null;
  return prisma.campaign.create({
    data: {
      businessId,
      name: data.name,
      body: data.body,
      segment: data.segment,
      channels: data.channels ?? [],
      scheduledAt: data.scheduledAt ?? null,
      status: scheduled ? 'SCHEDULED' : 'DRAFT',
    },
  });
}

/** יומן הודעות אחרון בעסק (לכל הקמפיינים). */
export function listMessageLog(businessId: string, take = 100) {
  return prisma.messageLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      campaign: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
}

export type SendCampaignResult =
  | { ok: true; recipientCount: number; sentCount: number; failedCount: number }
  | { ok: false; reason: 'not_found' | 'already_sent' | 'no_recipients' };

/** תלויות ניתנות להזרקה (לבדיקה). ברירת המחדל היא שער העלות האמיתי. */
export type SendCampaignDeps = {
  sendGuardedSms?: typeof defaultSendGuardedSms;
};

/**
 * שליחת קמפיין רב-ערוצי: מחשב נמענים לפי הפילוח והערוצים המותרים לדרגת החבילה,
 * שולח הודעה לכל צירוף לקוח×ערוץ-שמיש, ומעדכן סטטוס וספירות. ערוץ SMS בתשלום
 * מותר רק באקסלוסיב ועובר דרך שער העלות (חסימה בתקרה החודשית + רישום MessageLog
 * עצמי, בלי רישום כפול); מייל נשלח דרך שכבת המסירה ונרשם כאן. וואטסאפ מסונן תמיד.
 * מונע שליחה כפולה באמצעות "תפיסה" אטומית: רק מעבר יחיד DRAFT|SCHEDULED => SENDING
 * מצליח, כך ששני cron מקבילים לא ישלחו את אותו קמפיין פעמיים.
 */
export async function sendCampaign(
  businessId: string,
  id: string,
  deps: SendCampaignDeps = {},
): Promise<SendCampaignResult> {
  const sendGuardedSms = deps.sendGuardedSms ?? defaultSendGuardedSms;
  const campaign = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!campaign) return { ok: false, reason: 'not_found' };
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    return { ok: false, reason: 'already_sent' };
  }

  // דרגת החבילה קובעת אילו ערוצים מותרים: SMS בתשלום רק באקסלוסיב, וואטסאפ מסונן תמיד.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true, paidUntil: true },
  });
  const isExclusive = business != null && canSendPaidClientSms(business);

  const segment = normalizeSegment(campaign.segment);
  const clients = await resolveSegmentClients(businessId, segment);
  const channels = allowedCampaignChannels(campaign.channels, { isExclusive });
  const { messages, recipientCount } = resolveCampaignRecipients(clients, channels);
  if (messages.length === 0) return { ok: false, reason: 'no_recipients' };

  // תפיסה אטומית: רק מעבר יחיד ממצב שליח => SENDING מצליח (מגן מפני שליחה כפולה
  // כאשר שני cron מקבילים מרימים את אותו קמפיין מתוזמן).
  const claimed = await prisma.campaign.updateMany({
    where: { id: campaign.id, businessId, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: { status: 'SENDING', recipientCount },
  });
  if (claimed.count === 0) return { ok: false, reason: 'already_sent' };

  let sentCount = 0;
  let failedCount = 0;
  let smsBlocked = false;

  for (const message of messages) {
    if (message.channel === 'sms') {
      // ערוץ בתשלום — עובר דרך שער העלות, שרושם MessageLog בעצמו (בלי רישום כפול).
      if (smsBlocked) {
        failedCount += 1;
        continue;
      }
      const result = await sendGuardedSms({
        businessId,
        to: message.address,
        body: campaign.body,
        clientId: message.clientId,
        campaignId: campaign.id,
        channel: 'sms',
      });
      if (result.status === 'sent') {
        sentCount += 1;
      } else {
        failedCount += 1;
        // בתקרה — לחסום את שאר המסרונים בקמפיין (התקרה החודשית נשמרת בכל מקרה).
        if (result.status === 'blocked') smsBlocked = true;
      }
      continue;
    }

    // מייל (הערוץ היחיד שאינו בתשלום אחרי הסינון) — נשלח דרך שכבת המסירה ונרשם כאן.
    try {
      await deliverCampaignMessage(message.channel, message.address, campaign.body, {
        subject: campaign.name,
      });
      sentCount += 1;
      await prisma.messageLog.create({
        data: {
          businessId,
          campaignId: campaign.id,
          clientId: message.clientId,
          channel: message.channel,
          address: message.address,
          phone: null,
          body: campaign.body,
          status: 'SENT',
        },
      });
    } catch (err) {
      failedCount += 1;
      await prisma.messageLog.create({
        data: {
          businessId,
          campaignId: campaign.id,
          clientId: message.clientId,
          channel: message.channel,
          address: message.address,
          phone: null,
          body: campaign.body,
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'send failed',
        },
      });
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: failedCount > 0 && sentCount === 0 ? 'FAILED' : 'SENT',
      sentCount,
      failedCount,
      sentAt: new Date(),
    },
  });

  return { ok: true, recipientCount, sentCount, failedCount };
}

/**
 * קמפיינים מתוזמנים שהגיע זמנם (SCHEDULED עם scheduledAt <= now) — עבור ה-cron.
 * מחזיר מזהי עסק+קמפיין בלבד; השליחה עצמה נעשית ב-sendCampaign (עם תפיסה אטומית).
 */
export function getDueScheduledCampaigns(now: Date, take = 50) {
  return prisma.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { not: null, lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take,
    select: { id: true, businessId: true },
  });
}
