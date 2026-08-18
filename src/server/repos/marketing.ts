import { prisma } from '@/lib/db';
import { getSmsProvider } from '@/server/providers/sms';

/**
 * מודול דיוור SMS (marketing).
 * קמפיין מפולח ללקוחות: הפילוח מחושב בזמן שליחה (קריאה בלבד ממודל הלקוחות/תורים),
 * השליחה נעשית דרך ספק ה-SMS הקיים (stub שמדפיס ל-console), וכל נמען נרשם ב-MessageLog.
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

/** רשימת לקוחות (עם טלפון) התואמים לפילוח — לחישוב נמענים ולשליחה. */
export function resolveSegmentClients(businessId: string, segment: CampaignSegment) {
  return prisma.client.findMany({
    where: segmentWhere(businessId, segment),
    select: { id: true, name: true, phone: true },
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
};

/** יצירת קמפיין חדש במצב טיוטה. */
export function createCampaign(businessId: string, data: CreateCampaignInput) {
  return prisma.campaign.create({
    data: {
      businessId,
      name: data.name,
      body: data.body,
      segment: data.segment,
      status: 'DRAFT',
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

/**
 * שליחת קמפיין: מחשב נמענים לפי הפילוח, שולח לכל אחד דרך ספק ה-SMS (console stub),
 * רושם רשומת MessageLog לכל נמען, ומעדכן את סטטוס וספירות הקמפיין.
 * מונע שליחה כפולה — שולח רק כאשר הקמפיין במצב טיוטה.
 */
export async function sendCampaign(
  businessId: string,
  id: string,
): Promise<SendCampaignResult> {
  const campaign = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!campaign) return { ok: false, reason: 'not_found' };
  if (campaign.status !== 'DRAFT') return { ok: false, reason: 'already_sent' };

  const segment = normalizeSegment(campaign.segment);
  // רק לקוחות עם טלפון יכולים לקבל SMS/וואטסאפ; לקוחות מבוססי-מייל בלבד מדולגים.
  const recipients = (await resolveSegmentClients(businessId, segment)).filter(
    (c): c is typeof c & { phone: string } => Boolean(c.phone),
  );
  if (recipients.length === 0) return { ok: false, reason: 'no_recipients' };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'SENDING', recipientCount: recipients.length },
  });

  const sms = getSmsProvider();
  let sentCount = 0;
  let failedCount = 0;

  for (const client of recipients) {
    try {
      await sms.sendSms(client.phone, campaign.body);
      sentCount += 1;
      await prisma.messageLog.create({
        data: {
          businessId,
          campaignId: campaign.id,
          clientId: client.id,
          phone: client.phone,
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
          clientId: client.id,
          phone: client.phone,
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

  return { ok: true, recipientCount: recipients.length, sentCount, failedCount };
}
