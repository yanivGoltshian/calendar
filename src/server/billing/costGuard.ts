import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendSms, sendWhatsApp, MessagingConfigError } from '@/server/providers/messaging';
import { sendEmail } from '@/server/providers/email';
import { normalizePhone } from '@/lib/crypto';
import { canSendPaidClientSms } from '@/server/subscription';

/**
 * שער עלות חודשי לכל עסק עבור מסרונים בתשלום בפנייה ללקוח קצה
 * (אימות לקוח, תזכורת, אישור, קמפיין, רשימת המתנה).
 *
 * מנגנון זה חדש לגמרי — לא היה בקוד ספירת עלות או תקרה כלשהי. הוא נקודת
 * האכיפה המרכזית היחידה: לפני כל שליחה בתשלום נבדקת הצבירה החודשית של העסק
 * מול התקרה. מתחת לתקרה השליחה עוברת; בסף ההתראה נשלחת התראה חד-פעמית לבעל
 * העסק; בתקרה השליחה נחסמת עד תחילת החודש הבא.
 *
 * אימות טלפון של בעל העסק עצמו הוא חריג קבוע (countsToCap=false): הוא נשלח
 * תמיד, אינו נחסם, ונצבר בדלי נפרד מחוץ לתקרת הלקוח של העסק.
 */

// ---------- תצורה ניתנת לכוונון דרך משתני סביבה ----------

/** ברירות מחדל, בהתאם להחלטה: חסימה סביב 45₪, התראה סביב 40₪. */
const DEFAULT_CAP_AGOROT = 4500;
const DEFAULT_ALERT_AGOROT = 4000;
/**
 * הערכת עלות קבועה להודעה, באגורות. שער ישראלי טיפוסי נע בסדר גודל של אגורות
 * בודדות להודעה; ברירת מחדל שמרנית וניתנת לכוונון. אינה תלויה בספק ספציפי.
 */
const DEFAULT_UNIT_COST_AGOROT = 10;

export type CostGuardConfig = {
  capAgorot: number;
  alertAgorot: number;
  unitCostAgorot: number;
};

type CostGuardEnv = {
  SMS_MONTHLY_CAP_AGOROT?: string;
  SMS_MONTHLY_ALERT_AGOROT?: string;
  SMS_UNIT_COST_AGOROT?: string;
  [key: string]: string | undefined;
};

/** קורא מספר שלם לא-שלילי ממשתנה סביבה, עם נפילה לברירת מחדל בקלט לא תקין. */
function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw == null || !/^\d+$/.test(raw.trim())) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/**
 * בונה את תצורת שער העלות ממשתני הסביבה. סף ההתראה נכפה להיות לכל היותר
 * כגובה התקרה (התראה אחרי חסימה חסרת משמעות).
 */
export function resolveCostGuardConfig(
  env: CostGuardEnv = process.env,
): CostGuardConfig {
  const capAgorot = readNonNegativeInt(env.SMS_MONTHLY_CAP_AGOROT, DEFAULT_CAP_AGOROT);
  const rawAlert = readNonNegativeInt(env.SMS_MONTHLY_ALERT_AGOROT, DEFAULT_ALERT_AGOROT);
  const alertAgorot = Math.min(rawAlert, capAgorot);
  const unitCostAgorot = readNonNegativeInt(
    env.SMS_UNIT_COST_AGOROT,
    DEFAULT_UNIT_COST_AGOROT,
  );
  return { capAgorot, alertAgorot, unitCostAgorot };
}

// ---------- חלון החודש הנוכחי ----------

/** תחילת החודש הקלנדרי הנוכחי ב-UTC (בסיס איפוס התקרה). */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---------- צבירת השימוש החודשי ----------

type UsageDeps = {
  now?: Date;
  prismaClient?: { messageLog: { aggregate: typeof prisma.messageLog.aggregate } };
};

/**
 * סכום העלות החודשית (אגורות) של שליחות הנספרות אל מול התקרה עבור עסק —
 * costAgorot של רשומות MessageLog עם countsToCap=true בחודש הנוכחי.
 * שליחות שנחסמו/נכשלו נושאות costAgorot=0 ולכן אינן תורמות לצבירה.
 */
export async function getMonthlyPaidUsageAgorot(
  businessId: string,
  deps: UsageDeps = {},
): Promise<number> {
  const now = deps.now ?? new Date();
  const client = deps.prismaClient ?? prisma;
  const result = await client.messageLog.aggregate({
    _sum: { costAgorot: true },
    where: {
      businessId,
      countsToCap: true,
      createdAt: { gte: monthStartUtc(now) },
    },
  });
  return result._sum.costAgorot ?? 0;
}

// ---------- הכרעה טהורה (ללא תופעות לוואי) ----------

export type GuardDecision = {
  /** האם השליחה נחסמת (הצבירה כבר הגיעה לתקרה או עברה אותה). */
  blocked: boolean;
  /** האם השליחה הזו חוצה את סף ההתראה (מתחת לסף לפניה, בסף או מעליו אחריה). */
  crossesAlert: boolean;
  usedAgorot: number;
  projectedAgorot: number;
  capAgorot: number;
  alertAgorot: number;
};

/** מכריע חסימה/התראה עבור שליחה יחידה, בהינתן הצבירה הנוכחית והמחיר להודעה. */
export function evaluateGuard(
  usedAgorot: number,
  unitCostAgorot: number,
  config: CostGuardConfig,
): GuardDecision {
  const projectedAgorot = usedAgorot + unitCostAgorot;
  const blocked = usedAgorot >= config.capAgorot || projectedAgorot > config.capAgorot;
  const crossesAlert =
    usedAgorot < config.alertAgorot && projectedAgorot >= config.alertAgorot;
  return {
    blocked,
    crossesAlert,
    usedAgorot,
    projectedAgorot,
    capAgorot: config.capAgorot,
    alertAgorot: config.alertAgorot,
  };
}

// ---------- מצב לתצוגה בממשק ----------

export type CostGuardStatus = {
  usedAgorot: number;
  capAgorot: number;
  alertAgorot: number;
  remainingAgorot: number;
  atAlert: boolean;
  blocked: boolean;
};

/** מצב שער העלות של עסק לחודש הנוכחי — לצריכת הממשק (אזור ההגדרות). */
export async function getCostGuardStatus(
  businessId: string,
  deps: UsageDeps & { config?: CostGuardConfig } = {},
): Promise<CostGuardStatus> {
  const config = deps.config ?? resolveCostGuardConfig();
  const usedAgorot = await getMonthlyPaidUsageAgorot(businessId, deps);
  return {
    usedAgorot,
    capAgorot: config.capAgorot,
    alertAgorot: config.alertAgorot,
    remainingAgorot: Math.max(0, config.capAgorot - usedAgorot),
    atAlert: usedAgorot >= config.alertAgorot,
    blocked: usedAgorot >= config.capAgorot,
  };
}

// ---------- שליחה מוגנת ----------

export type GuardedSmsRequest = {
  businessId: string;
  /** יעד — מספר טלפון. */
  to: string;
  body: string;
  clientId?: string | null;
  appointmentId?: string;
  idempotencyKey?: string;
  campaignId?: string | null;
  /** ערוץ לתיעוד ביומן; ברירת מחדל sms. */
  channel?: string;
  /** Compatibility input only: false is rejected; every paid client send consumes budget. */
  countsToCap?: boolean;
  /** דריסת מחיר להודעה; ברירת מחדל מהתצורה. */
  unitCostAgorot?: number;
};

export type GuardedSmsResult =
  | { status: 'sent'; costAgorot: number; crossedAlert: boolean; duplicate?: boolean }
  | { status: 'blocked'; usedAgorot: number; capAgorot: number; reason?: string }
  | { status: 'failed'; error: string };

export type GuardedSmsDeps = {
  now?: Date;
  config?: CostGuardConfig;
  prismaClient?: PrismaClient;
  sendSms?: (to: string, body: string) => Promise<void>;
  onAlert?: (businessId: string, status: CostGuardStatus) => Promise<void>;
};

/** התראת עלות מיטבית לבעל העסק במייל — לעולם אינה זורקת ואינה חוסמת שליחה. */
async function defaultOnAlert(
  businessId: string,
  status: CostGuardStatus,
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, ownerEmail: true },
    });
    const to = business?.ownerEmail;
    if (!to) return;
    const usedShekel = (status.usedAgorot / 100).toFixed(2);
    const capShekel = (status.capAgorot / 100).toFixed(2);
    const subject = 'התראת עלות מסרונים חודשית';
    const text =
      `שלום,\n\nהעסק ${business?.name ?? ''} עבר את סף ההתראה לעלות מסרונים בחודש הנוכחי.\n` +
      `נצברו ${usedShekel} ש"ח מתוך תקרה של ${capShekel} ש"ח.\n` +
      `בהגעה לתקרה שליחת המסרונים בתשלום תיחסם עד תחילת החודש הבא.\n`;
    await sendEmail(to, subject, text);
  } catch (err) {
    console.warn('[costGuard] owner alert failed', err);
  }
}

/**
 * נקודת האכיפה המרכזית לשליחת מסרון בתשלום. בודקת תקרה, שולחת, ומתעדת עלות.
 * החוסמת (blocked) מתועדת כרשומת BLOCKED בעלות 0; שליחה מוצלחת מתועדת כ-SENT
 * עם העלות; חציית סף ההתראה מפעילה התראה מיטבית חד-פעמית לבעל העסק.
 */
export async function sendGuardedSms(
  req: GuardedSmsRequest,
  deps: GuardedSmsDeps = {},
): Promise<GuardedSmsResult> {
  const now = deps.now ?? new Date();
  const config = deps.config ?? resolveCostGuardConfig();
  const db = deps.prismaClient ?? prisma;
  const unitCostAgorot = Math.max(1, config.unitCostAgorot, req.unitCostAgorot ?? 0);
  const channel = req.channel ?? 'sms';
  const phone = normalizePhone(req.to);
  const doSend = deps.sendSms ?? (channel === 'whatsapp' ? sendWhatsApp : sendSms);
  const onAlert = deps.onAlert ?? defaultOnAlert;
  const key = createHash('sha256')
    .update(JSON.stringify([req.businessId, channel, phone, req.idempotencyKey ?? req.body]))
    .digest('hex');
  const logData = {
    businessId: req.businessId,
    channel,
    phone,
    address: phone,
    body: req.body,
    countsToCap: true,
  };
  let reservation: { id: string; decision: GuardDecision };
  try {
    const reserved = await db.$transaction(async (tx) => {
      // The global transaction lock serializes *reservations*, never network I/O.
      // It protects every tenant and recipient quota across all worker processes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(704193821)`;
      const existing = await tx.messageLog.findUnique({ where: { idempotencyKey: key } });
      const business = await tx.business.findUnique({ where: { id: req.businessId } });
      if (!business) return { denied: 'business_not_found', used: 0 } as const;
      const usage = await tx.messageLog.aggregate({
        where: { businessId: req.businessId, countsToCap: true, createdAt: { gte: monthStartUtc(now) } },
        _sum: { costAgorot: true },
      });
      const used = usage._sum.costAgorot ?? 0;
      const deny = async (reason: string) => {
        await tx.messageLog.create({
          data: { ...logData, status: 'BLOCKED', costAgorot: 0, error: reason },
        });
        return { denied: reason, used } as const;
      };
      if (business.accountStatus !== 'ACTIVE' || !canSendPaidClientSms(business)) return deny('entitlement_denied');
      if (req.countsToCap === false) return deny('budget_bypass_denied');
      if (!Number.isSafeInteger(unitCostAgorot)) return deny('invalid_cost');
      if (existing?.status === 'SENT') return { duplicate: true } as const;
      if (existing && existing.status !== 'FAILED') return deny('delivery_outcome_unknown');
      const appointment = req.appointmentId
        ? await tx.appointment.findFirst({
            where: { id: req.appointmentId, businessId: req.businessId, status: 'CONFIRMED' },
          })
        : null;
      if (req.appointmentId && !appointment) return deny('appointment_not_active');
      const client = await tx.client.findFirst({
        where: { id: appointment?.clientId ?? req.clientId ?? '', businessId: req.businessId, blocked: false },
        include: { user: true },
      });
      if (!client?.identityVerifiedAt || !client.user?.phone || !client.user.phoneVerifiedAt ||
          normalizePhone(client.user.phone) !== phone) return deny('recipient_unverified');
      if (req.campaignId && !await tx.campaign.findFirst({
        where: { id: req.campaignId, businessId: req.businessId, status: 'SENDING' },
      })) return deny('campaign_not_active');
      const decision = evaluateGuard(used, unitCostAgorot, config);
      if (decision.blocked) return deny('cost_cap_exceeded');
      const recent = { createdAt: { gte: new Date(now.getTime() - 3600000) }, countsToCap: true, status: { not: 'BLOCKED' as const } };
      const [recipientCount, businessCount, globalCount, globalUsage] = await Promise.all([
        tx.messageLog.count({ where: { ...recent, phone } }),
        tx.messageLog.count({ where: { ...recent, businessId: req.businessId } }),
        tx.messageLog.count({ where: recent }),
        tx.messageLog.aggregate({ where: { countsToCap: true, createdAt: { gte: monthStartUtc(now) } }, _sum: { costAgorot: true } }),
      ]);
      if (recipientCount >= readNonNegativeInt(process.env.PAID_RECIPIENT_HOURLY_LIMIT, 6)) return deny('recipient_quota');
      if (businessCount >= readNonNegativeInt(process.env.PAID_BUSINESS_HOURLY_LIMIT, 200)) return deny('business_quota');
      if (globalCount >= readNonNegativeInt(process.env.PAID_GLOBAL_HOURLY_LIMIT, 2000)) return deny('global_quota');
      if ((globalUsage._sum.costAgorot ?? 0) + unitCostAgorot > readNonNegativeInt(process.env.PAID_GLOBAL_MONTHLY_CAP_AGOROT, 450000)) return deny('global_cost_cap');
      const data = {
        ...logData, clientId: client.id, campaignId: req.campaignId ?? null,
        status: 'RESERVED' as const, costAgorot: unitCostAgorot,
        reservedAt: now, createdAt: now, error: null,
      };
      const row = existing
        ? await tx.messageLog.update({ where: { id: existing.id }, data })
        : await tx.messageLog.create({ data: { ...data, idempotencyKey: key } });
      return { id: row.id, decision };
    }, { maxWait: 10000, timeout: 15000 });
    if ('duplicate' in reserved) return { status: 'sent', costAgorot: 0, crossedAlert: false, duplicate: true };
    if ('denied' in reserved) return { status: 'blocked', reason: reserved.denied, usedAgorot: reserved.used, capAgorot: config.capAgorot };
    reservation = reserved;
  } catch {
    return { status: 'failed', error: 'reservation_failed' };
  }

  try {
    // Account deletion or cancellation after reservation must still prevent dispatch.
    const active = await db.business.findUnique({ where: { id: req.businessId } });
    const appointmentActive = !req.appointmentId || await db.appointment.findFirst({
      where: { id: req.appointmentId, businessId: req.businessId, status: 'CONFIRMED' },
    });
    const campaignActive = !req.campaignId || await db.campaign.findFirst({
      where: { id: req.campaignId, businessId: req.businessId, status: 'SENDING' },
    });
    if (!active || active.accountStatus !== 'ACTIVE' || !canSendPaidClientSms(active) || !appointmentActive || !campaignActive) {
      await db.messageLog.update({ where: { id: reservation.id }, data: { status: 'FAILED', costAgorot: 0, error: 'lifecycle_changed' } });
      return { status: 'blocked', reason: 'lifecycle_changed', usedAgorot: reservation.decision.usedAgorot, capAgorot: config.capAgorot };
    }
  } catch {
    return { status: 'failed', error: 'pre_dispatch_check_failed' };
  }
  try {
    await doSend(phone, req.body);
  } catch (err) {
    const definitelyNotSent = err instanceof MessagingConfigError;
    await db.messageLog.update({
      where: { id: reservation.id },
      data: {
        status: definitelyNotSent ? 'FAILED' : 'UNKNOWN',
        costAgorot: definitelyNotSent ? 0 : unitCostAgorot,
        error: definitelyNotSent ? 'provider_not_configured' : 'delivery_outcome_unknown',
      },
    }).catch(() => undefined);
    return { status: 'failed', error: definitelyNotSent ? 'provider_not_configured' : 'delivery_outcome_unknown' };
  }
  // A successful provider call with failed persistence is NOT a retryable failure.
  // The reservation continues to consume budget and blocks a duplicate dispatch.
  try {
    await db.messageLog.update({ where: { id: reservation.id }, data: { status: 'SENT', error: null } });
  } catch {
    return { status: 'failed', error: 'delivery_outcome_unknown' };
  }
  const crossedAlert = reservation.decision.crossesAlert;
  if (crossedAlert) {
    const usedAfter = reservation.decision.projectedAgorot;
    await onAlert(req.businessId, {
      usedAgorot: usedAfter, capAgorot: config.capAgorot, alertAgorot: config.alertAgorot,
      remainingAgorot: Math.max(0, config.capAgorot - usedAfter), atAlert: true,
      blocked: usedAfter >= config.capAgorot,
    }).catch(() => undefined);
  }
  return { status: 'sent', costAgorot: unitCostAgorot, crossedAlert };
}
