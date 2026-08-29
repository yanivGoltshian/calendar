import type { MessageStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendSms } from '@/server/providers/messaging';
import { sendEmail } from '@/server/providers/email';

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
  if (raw == null) return fallback;
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
  const blocked = usedAgorot >= config.capAgorot;
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
  campaignId?: string | null;
  /** ערוץ לתיעוד ביומן; ברירת מחדל sms. */
  channel?: string;
  /**
   * האם השליחה נספרת אל מול התקרה. ברירת מחדל true (פנייה בתשלום ללקוח).
   * אימות בעל העסק מעביר false — נשלח תמיד ונצבר בדלי נפרד.
   */
  countsToCap?: boolean;
  /** דריסת מחיר להודעה; ברירת מחדל מהתצורה. */
  unitCostAgorot?: number;
};

export type GuardedSmsResult =
  | { status: 'sent'; costAgorot: number; crossedAlert: boolean }
  | { status: 'blocked'; usedAgorot: number; capAgorot: number }
  | { status: 'failed'; error: string };

type LogInput = {
  businessId: string;
  clientId?: string | null;
  campaignId?: string | null;
  channel: string;
  phone: string;
  body: string;
  status: MessageStatus;
  costAgorot: number;
  countsToCap: boolean;
  error?: string | null;
};

export type GuardedSmsDeps = {
  now?: Date;
  config?: CostGuardConfig;
  /** צבירה חודשית נוכחית לעסק (אגורות). */
  getUsage?: (businessId: string, now: Date) => Promise<number>;
  /** שליחת המסרון בפועל. */
  sendSms?: (to: string, body: string) => Promise<void>;
  /** כתיבת רשומת יומן. */
  logMessage?: (input: LogInput) => Promise<void>;
  /** התראה חד-פעמית לבעל העסק בחציית סף ההתראה (מיטבית, לא חוסמת). */
  onAlert?: (businessId: string, status: CostGuardStatus) => Promise<void>;
};

/** כתיבת רשומת MessageLog בפועל. */
async function defaultLogMessage(input: LogInput): Promise<void> {
  await prisma.messageLog.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId ?? null,
      campaignId: input.campaignId ?? null,
      channel: input.channel,
      phone: input.phone,
      address: input.phone,
      body: input.body,
      status: input.status,
      costAgorot: input.costAgorot,
      countsToCap: input.countsToCap,
      error: input.error ?? null,
    },
  });
}

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
  const countsToCap = req.countsToCap ?? true;
  const unitCostAgorot = req.unitCostAgorot ?? config.unitCostAgorot;
  const channel = req.channel ?? 'sms';

  const getUsage =
    deps.getUsage ?? ((id, at) => getMonthlyPaidUsageAgorot(id, { now: at }));
  const doSend = deps.sendSms ?? ((to, body) => sendSms(to, body));
  const log = deps.logMessage ?? defaultLogMessage;
  const onAlert = deps.onAlert ?? defaultOnAlert;

  let decision: GuardDecision | null = null;

  // בדיקת תקרה — רק לשליחות הנספרות (פנייה בתשלום ללקוח).
  if (countsToCap) {
    const used = await getUsage(req.businessId, now);
    decision = evaluateGuard(used, unitCostAgorot, config);
    if (decision.blocked) {
      await log({
        businessId: req.businessId,
        clientId: req.clientId,
        campaignId: req.campaignId,
        channel,
        phone: req.to,
        body: req.body,
        status: 'BLOCKED',
        costAgorot: 0,
        countsToCap: true,
        error: 'cost_cap_exceeded',
      });
      return {
        status: 'blocked',
        usedAgorot: decision.usedAgorot,
        capAgorot: decision.capAgorot,
      };
    }
  }

  // שליחה בפועל.
  try {
    await doSend(req.to, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log({
      businessId: req.businessId,
      clientId: req.clientId,
      campaignId: req.campaignId,
      channel,
      phone: req.to,
      body: req.body,
      status: 'FAILED',
      costAgorot: 0,
      countsToCap,
      error: message,
    });
    return { status: 'failed', error: message };
  }

  // תיעוד הצלחה עם העלות.
  await log({
    businessId: req.businessId,
    clientId: req.clientId,
    campaignId: req.campaignId,
    channel,
    phone: req.to,
    body: req.body,
    status: 'SENT',
    costAgorot: unitCostAgorot,
    countsToCap,
    error: null,
  });

  const crossedAlert = countsToCap && decision != null && decision.crossesAlert;
  if (crossedAlert) {
    const usedAfter = (decision as GuardDecision).projectedAgorot;
    await onAlert(req.businessId, {
      usedAgorot: usedAfter,
      capAgorot: config.capAgorot,
      alertAgorot: config.alertAgorot,
      remainingAgorot: Math.max(0, config.capAgorot - usedAfter),
      atAlert: true,
      blocked: usedAfter >= config.capAgorot,
    });
  }

  return { status: 'sent', costAgorot: unitCostAgorot, crossedAlert };
}
