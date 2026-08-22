/**
 * מתאם ערוץ הוואטסאפ (MessagingChannel) — הליבה של הזרימה מקצה לקצה.
 *
 * זהו ה"מוח" של ערוץ הוואטסאפ: לכל שליחה הוא (1) טוען את העסק ואת מצב הצובר,
 * (2) גוזר את הערוצים המותרים לפי החבילה (Exclusive בלבד לוואטסאפ), (3) בודק חסימה
 * חודשית טרם שליחה, (4) קורא לשכבת התובלה (acsTransport), (5) רושם יומן
 * (WhatsAppMessageLog) לכל ניסיון, (6) צובר עלות רק בהצלחה, ו-(7) מפעיל את מיילי
 * ההתראה בחציית הספים. אחריות-על: לעולם לא לזרוק חריגה אל תוך זרימת ההזמנה.
 *
 * חוזה אי-הזריקה: כל קריאה מחזירה WhatsAppSendResult מובנה. כשל תובלה, טלפון לא
 * תקין, חבילה חסרה, חסימה או אפילו כשל DB — כולם מתורגמים לתוצאה עם emailFallback,
 * ולעולם לא מפילים את הקורא. שליחה כושלת אינה מגדילה את צובר העלות.
 *
 * הזרקת תלויות: הליבה מקבלת ChannelDeps (prisma, config, now, transport, alerts)
 * כדי שאפשר יהיה לבדוק אותה בלי DB/רשת. ה-API הציבורי בונה deps ברירת מחדל אמיתיים.
 */

import type { WhatsAppMessageType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';
import {
  loadWhatsAppConfig,
  rateForType,
  templateForType,
  type WhatsAppConfig,
} from './config';
import {
  applySuccessfulSend,
  currentMonth,
  isBlockedForMonth,
  type BusinessCostState,
} from './cost';
import { resolveTierChannels } from './tier';
import {
  sendTemplate as acsSendTemplate,
  sendText as acsSendText,
  type AcsSendResult,
} from './acsTransport';
import {
  sendOwnerUsageNoticeEmail,
  sendSuperAdminBlockEmail,
  sendSuperAdminWarnEmail,
} from './alerts';

/** מצב תוצאת שליחה של ערוץ הוואטסאפ. */
export type WhatsAppSendStatus = 'sent' | 'skipped' | 'failed' | 'blocked';

/** תוצאה מובנית של ניסיון שליחת וואטסאפ. */
export interface WhatsAppSendResult {
  status: WhatsAppSendStatus;
  channel: 'whatsapp';
  /** האם על הקורא למסור את ההודעה בערוץ המייל (נפילה). true בכל מצב שאינו 'sent'. */
  emailFallback: boolean;
  /** מזהה ההודעה מהספק (בהצלחה בלבד). */
  providerMessageId?: string;
  /** קוד שגיאה/דילוג לשמירה וללוג. */
  errorCode?: string;
  /** העלות שחויבה בפועל (אגורות). 0 בכל מצב שאינו 'sent'. */
  costAgorot: number;
  /** מזהה שורת היומן שנרשמה (אם נרשמה). */
  logId?: string;
  /** האם נחצה כעת סף האזהרה (פעם ראשונה החודש). */
  crossedWarn?: boolean;
  /** האם נחסם כעת (מעבר לחסום). */
  reachedBlock?: boolean;
}

/** תת-קבוצת שדות ה-Business הדרושה לליבה. */
export interface WhatsAppBusinessRow extends BusinessCostState {
  id: string;
  name: string;
  plan: string;
  ownerEmail: string | null;
}

/** ממשק Prisma מינימלי שהליבה צורכת (כדי לאפשר החלפה בבדיקות). */
export interface WhatsAppPrismaLike {
  business: {
    findUnique(args: {
      where: { id: string };
      select?: Record<string, boolean>;
    }): Promise<WhatsAppBusinessRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  whatsAppMessageLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** תלויות ההתראות (ניתנות להזרקה/מוק בבדיקות). */
export interface ChannelAlertDeps {
  sendSuperAdminWarnEmail: typeof sendSuperAdminWarnEmail;
  sendSuperAdminBlockEmail: typeof sendSuperAdminBlockEmail;
  sendOwnerUsageNoticeEmail: typeof sendOwnerUsageNoticeEmail;
}

/** אוסף התלויות של הליבה. */
export interface ChannelDeps {
  prisma: WhatsAppPrismaLike;
  config: WhatsAppConfig;
  now: () => Date;
  sendTemplate: typeof acsSendTemplate;
  sendText: typeof acsSendText;
  alerts: ChannelAlertDeps;
}

/** קלט פנימי אחיד לשליחה בודדת. */
interface DeliverInput {
  businessId: string;
  toPhone: string;
  type: WhatsAppMessageType;
  /** שם תבנית מפורש (גובר על תבנית הקונפיג לפי הסוג). לקמפיין: תבנית שיווקית. */
  templateName?: string;
  /** פרמטרים סדורים לגוף התבנית. */
  bodyParams?: string[];
  /** טקסט חופשי (קמפיין בחלון 24ש) — משמש רק כשאין תבנית. */
  text?: string;
}

/** שדות ה-Business שנשלפים. */
const BUSINESS_SELECT = {
  id: true,
  name: true,
  plan: true,
  ownerEmail: true,
  monthlyWhatsappCostAgorot: true,
  whatsappCostMonth: true,
  whatsappBlocked: true,
  whatsappWarn40SentForMonth: true,
  whatsappOverrideApprovedForMonth: true,
} as const;

/** בונה תלויות ברירת מחדל אמיתיות (prisma, env, transport, alerts). */
function defaultDeps(): ChannelDeps {
  return {
    prisma: prisma as unknown as WhatsAppPrismaLike,
    config: loadWhatsAppConfig(),
    now: () => new Date(),
    sendTemplate: acsSendTemplate,
    sendText: acsSendText,
    alerts: {
      sendSuperAdminWarnEmail,
      sendSuperAdminBlockEmail,
      sendOwnerUsageNoticeEmail,
    },
  };
}

/** רושם שורת יומן בצורה בטוחה; כשל רישום לא מפיל את הזרימה. */
async function writeLog(
  deps: ChannelDeps,
  data: {
    businessId: string;
    toPhone: string;
    messageType: WhatsAppMessageType;
    templateName?: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED' | 'BLOCKED';
    providerMessageId?: string;
    estimatedCostAgorot: number;
    errorCode?: string;
    month: string;
  },
): Promise<string | undefined> {
  try {
    const row = await deps.prisma.whatsAppMessageLog.create({ data });
    return row.id;
  } catch (err) {
    console.error(
      '[whatsapp:channel] רישום יומן נכשל',
      err instanceof Error ? err.message : String(err),
    );
    return undefined;
  }
}

/** ממפה AcsSendResult (כשל/דילוג) לקוד השגיאה שיישמר. */
function resultErrorCode(res: AcsSendResult): string {
  return res.errorCode ?? (res.skipped ? 'ACS_SKIPPED' : 'ACS_SEND_ERROR');
}

/**
 * ליבת השליחה. מקבלת deps מוזרקים; מבצעת את כל הממשל, הרישום וההתראות; לעולם
 * אינה זורקת. כל ענף מחזיר WhatsAppSendResult מובנה.
 */
export async function deliverWhatsApp(
  deps: ChannelDeps,
  input: DeliverInput,
): Promise<WhatsAppSendResult> {
  const fail = (status: WhatsAppSendStatus, errorCode?: string): WhatsAppSendResult => ({
    status,
    channel: 'whatsapp',
    emailFallback: status !== 'sent',
    errorCode,
    costAgorot: 0,
  });

  try {
    const month = currentMonth(deps.now());

    // 1. טעינת העסק ומצב הצובר.
    const business = await deps.prisma.business.findUnique({
      where: { id: input.businessId },
      select: { ...BUSINESS_SELECT },
    });
    if (!business) {
      // אין עסק לשייך אליו יומן/עלות — דילוג שקט עם נפילה למייל.
      return fail('skipped', 'BUSINESS_NOT_FOUND');
    }

    // 2. שער חבילה: וואטסאפ שמור ל-Exclusive בלבד.
    const channels = resolveTierChannels(business.plan);
    if (!channels.whatsapp) {
      return fail('skipped', 'TIER_NO_WHATSAPP');
    }

    // 3. אימות טלפון בסיסי (חוסך קריאת ספק על מספר לא תקין).
    const normalizedPhone = normalizePhone(input.toPhone);
    if (!isValidIsraeliMobile(normalizedPhone)) {
      await writeLog(deps, {
        businessId: business.id,
        toPhone: normalizedPhone || input.toPhone,
        messageType: input.type,
        templateName: input.templateName,
        status: 'FAILED',
        estimatedCostAgorot: 0,
        errorCode: 'INVALID_PHONE',
        month,
      });
      return fail('failed', 'INVALID_PHONE');
    }

    // 4. שער חסימה חודשי טרם שליחה.
    if (isBlockedForMonth(business, month, deps.config.blockAgorot)) {
      const logId = await writeLog(deps, {
        businessId: business.id,
        toPhone: normalizedPhone,
        messageType: input.type,
        templateName: input.templateName,
        status: 'BLOCKED',
        estimatedCostAgorot: 0,
        errorCode: 'MONTHLY_BLOCK',
        month,
      });
      return { ...fail('blocked', 'MONTHLY_BLOCK'), logId };
    }

    // 5. בחירת תבנית/טקסט. תבנית מפורשת גוברת; אחרת תבנית הקונפיג לפי הסוג.
    const templateName = input.templateName ?? templateForType(deps.config, input.type);
    let res: AcsSendResult;
    if (templateName) {
      res = await deps.sendTemplate(deps.config, {
        toPhone: normalizedPhone,
        templateName,
        language: deps.config.templateLang,
        bodyParams: input.bodyParams,
      });
    } else if (input.text) {
      // אין תבנית מוגדרת — נפילה לטקסט חופשי (קמפיין בחלון 24ש).
      res = await deps.sendText(deps.config, { toPhone: normalizedPhone, text: input.text });
    } else {
      // אין תבנית ואין טקסט — הסוג דורש תבנית שלא הוגדרה => דילוג (ללא עלות).
      const logId = await writeLog(deps, {
        businessId: business.id,
        toPhone: normalizedPhone,
        messageType: input.type,
        status: 'SKIPPED',
        estimatedCostAgorot: 0,
        errorCode: 'NO_TEMPLATE_CONFIGURED',
        month,
      });
      return { ...fail('skipped', 'NO_TEMPLATE_CONFIGURED'), logId };
    }

    // 6. דילוג (קונפיג/חבילה חסרים) — לוג SKIPPED, ללא עלות, נפילה למייל.
    if (res.skipped) {
      const logId = await writeLog(deps, {
        businessId: business.id,
        toPhone: normalizedPhone,
        messageType: input.type,
        templateName,
        status: 'SKIPPED',
        estimatedCostAgorot: 0,
        errorCode: resultErrorCode(res),
        month,
      });
      return { ...fail('skipped', resultErrorCode(res)), logId };
    }

    // 7. כשל אמיתי מול הספק — לוג FAILED, ללא עלות, נפילה למייל. לעולם לא זורק.
    if (!res.ok) {
      const logId = await writeLog(deps, {
        businessId: business.id,
        toPhone: normalizedPhone,
        messageType: input.type,
        templateName,
        status: 'FAILED',
        estimatedCostAgorot: 0,
        errorCode: resultErrorCode(res),
        month,
      });
      return { ...fail('failed', resultErrorCode(res)), logId };
    }

    // 8. הצלחה — צבירת עלות, שמירת עדכון ה-Business, לוג SENT, והתראות בחציית ספים.
    const rate = rateForType(deps.config, input.type);
    const wasBlocked = business.whatsappBlocked;
    const outcome = applySuccessfulSend(
      business,
      month,
      rate,
      deps.config.warnAgorot,
      deps.config.blockAgorot,
    );

    // עדכון צובר העלות והדגלים ב-Business (best-effort — כשל DB לא זורק החוצה).
    try {
      await deps.prisma.business.update({
        where: { id: business.id },
        data: outcome.update,
      });
    } catch (err) {
      console.error(
        '[whatsapp:channel] עדכון צובר העלות נכשל',
        err instanceof Error ? err.message : String(err),
      );
    }

    const logId = await writeLog(deps, {
      businessId: business.id,
      toPhone: normalizedPhone,
      messageType: input.type,
      templateName,
      status: 'SENT',
      providerMessageId: res.providerMessageId,
      estimatedCostAgorot: rate,
      month,
    });

    // תופעות לוואי (מיילים) — לעולם לא מפילות; כל אחת בטוחה בפני עצמה.
    if (outcome.crossedWarn) {
      await deps.alerts.sendSuperAdminWarnEmail({
        config: deps.config,
        businessId: business.id,
        businessName: business.name,
        month,
        costAgorot: outcome.newTotalAgorot,
      });
      await deps.alerts.sendOwnerUsageNoticeEmail({
        ownerEmail: business.ownerEmail,
        businessName: business.name,
        month,
        costAgorot: outcome.newTotalAgorot,
        blocked: false,
      });
    }
    // מייל חסימה פעם אחת, רק במעבר מ"לא חסום" ל"חסום".
    if (outcome.reachedBlock && !wasBlocked) {
      await deps.alerts.sendSuperAdminBlockEmail({
        config: deps.config,
        businessId: business.id,
        businessName: business.name,
        month,
        costAgorot: outcome.newTotalAgorot,
      });
      if (!outcome.crossedWarn) {
        // אם לא נשלחה כבר הודעת בעל עסק בחציית האזהרה, נשלח הודעת חסימה.
        await deps.alerts.sendOwnerUsageNoticeEmail({
          ownerEmail: business.ownerEmail,
          businessName: business.name,
          month,
          costAgorot: outcome.newTotalAgorot,
          blocked: true,
        });
      }
    }

    return {
      status: 'sent',
      channel: 'whatsapp',
      emailFallback: false,
      providerMessageId: res.providerMessageId,
      costAgorot: rate,
      logId,
      crossedWarn: outcome.crossedWarn,
      reachedBlock: outcome.reachedBlock,
    };
  } catch (err) {
    // רשת ביטחון אחרונה: שום דבר לא זורק אל תוך זרימת ההזמנה.
    console.error(
      '[whatsapp:channel] שגיאה בלתי צפויה בשליחת וואטסאפ',
      err instanceof Error ? err.message : String(err),
    );
    return fail('failed', 'CHANNEL_INTERNAL');
  }
}

// ————————————————————————————————————————————————————————————————
// ה-API הציבורי של המתאם (MessagingChannel). כל פונקציה בונה deps אמיתיים
// ומאצילה לליבה. חתימות ידידותיות לאתרי-הקריאה (OTP/אישור/תזכורת/קמפיין).
// ————————————————————————————————————————————————————————————————

/** קלט לשליחת OTP בוואטסאפ. */
export interface SendOtpInput {
  businessId: string;
  toPhone: string;
  code: string;
}

/** קלט לשליחת אישור/תזכורת תור בוואטסאפ (פרמטרים סדורים לפי התבנית המאושרת). */
export interface SendAppointmentInput {
  businessId: string;
  toPhone: string;
  /** פרמטרים סדורים לגוף התבנית (למשל שם לקוח, שירות, מועד). */
  bodyParams?: string[];
}

/** קלט לשליחת קמפיין/דיוור בוואטסאפ. */
export interface SendCampaignInput {
  businessId: string;
  toPhone: string;
  /** שם תבנית שיווקית מאושרת (מומלץ מחוץ לחלון 24ש). */
  templateName?: string;
  /** פרמטרים סדורים לגוף התבנית. */
  bodyParams?: string[];
  /** טקסט חופשי (בתוך חלון 24ש) כשאין תבנית. */
  text?: string;
}

/** שולח קוד אימות (OTP) בוואטסאפ. */
export function sendOtp(
  input: SendOtpInput,
  deps: ChannelDeps = defaultDeps(),
): Promise<WhatsAppSendResult> {
  return deliverWhatsApp(deps, {
    businessId: input.businessId,
    toPhone: input.toPhone,
    type: 'OTP',
    bodyParams: [input.code],
  });
}

/** שולח אישור תור בוואטסאפ (תבנית utility). */
export function sendAppointmentConfirmation(
  input: SendAppointmentInput,
  deps: ChannelDeps = defaultDeps(),
): Promise<WhatsAppSendResult> {
  return deliverWhatsApp(deps, {
    businessId: input.businessId,
    toPhone: input.toPhone,
    type: 'CONFIRMATION',
    bodyParams: input.bodyParams,
  });
}

/** שולח תזכורת תור בוואטסאפ (תבנית utility). */
export function sendAppointmentReminder(
  input: SendAppointmentInput,
  deps: ChannelDeps = defaultDeps(),
): Promise<WhatsAppSendResult> {
  return deliverWhatsApp(deps, {
    businessId: input.businessId,
    toPhone: input.toPhone,
    type: 'REMINDER',
    bodyParams: input.bodyParams,
  });
}

/** שולח הודעת קמפיין/דיוור בוואטסאפ (תבנית שיווקית או טקסט בחלון 24ש). */
export function sendCampaign(
  input: SendCampaignInput,
  deps: ChannelDeps = defaultDeps(),
): Promise<WhatsAppSendResult> {
  return deliverWhatsApp(deps, {
    businessId: input.businessId,
    toPhone: input.toPhone,
    type: 'CAMPAIGN',
    templateName: input.templateName,
    bodyParams: input.bodyParams,
    text: input.text,
  });
}
