/**
 * תצורת ערוץ הוואטסאפ (Azure Communication Services · Advanced Messaging).
 *
 * כל הערכים נגזרים ממשתני סביבה בלבד — אין מחרוזות חיבור או מפתחות בקוד. הפונקציה
 * loadWhatsAppConfig טהורה (מקבלת env) כדי שאפשר יהיה לבדוק אותה, והיא מרכזת את
 * התעריפים (באגורות), הספים, שמות התבניות, ושער השליחה (gating).
 *
 * שער חי-ומוכן: הערוץ נחשב "מוכן לשליחה אמיתית" רק כאשר גם ACS_CONNECTION_STRING
 * וגם ACS_WHATSAPP_CHANNEL_ID מוגדרים. עד אז כל השרשרת (לוג, צבירת עלות, ספים)
 * עובדת עם דילוג (SKIPPED) על השליחה בפועל, כך שהפעלה אמיתית היא ברוחב משתנה סביבה
 * אחד (ACS_WHATSAPP_CHANNEL_ID) לאחר אישור התבניות במטא.
 *
 * משתני הסביבה:
 *   ACS_CONNECTION_STRING           (סוד) מחרוזת חיבור ל-ACS; נוכחות => טרנספורט זמין.
 *   ACS_WHATSAPP_CHANNEL_ID         מזהה ערוץ הוואטסאפ הרשום (WABA channel). נוכחות
 *                                   => שליחה אמיתית מופעלת.
 *   WA_TEMPLATE_OTP                 שם תבנית מאושרת לאימות/OTP.
 *   WA_TEMPLATE_CONFIRM             שם תבנית מאושרת לאישור תור (utility).
 *   WA_TEMPLATE_REMINDER            שם תבנית מאושרת לתזכורת תור (utility).
 *   WA_TEMPLATE_LANG                (ברירת מחדל he) קוד שפת התבניות המאושרות.
 *   WHATSAPP_UTILITY_RATE_AGOROT    (ברירת מחדל 12) עלות משוערת להודעת utility.
 *   WHATSAPP_AUTH_RATE_AGOROT       (ברירת מחדל = utility) עלות משוערת להודעת auth.
 *   WHATSAPP_MARKETING_RATE_AGOROT  (ברירת מחדל = utility) עלות משוערת להודעת שיווק.
 *   WHATSAPP_MONTHLY_WARN_AGOROT    (ברירת מחדל 4000 = 40₪) סף אזהרה חודשי לעסק.
 *   WHATSAPP_MONTHLY_BLOCK_AGOROT   (ברירת מחדל 4500 = 45₪) סף חסימה חודשי לעסק.
 *   SUPER_ADMIN_EMAIL               (ברירת מחדל = ברירת המחדל של PLATFORM_ADMIN_EMAILS)
 *                                   יעד מיילי ההתראה על חריגה.
 */

import type { WhatsAppMessageType } from '@prisma/client';

/** ברירות מחדל לתעריפים ולספים (באגורות). */
export const DEFAULT_UTILITY_RATE_AGOROT = 12;
export const DEFAULT_WARN_AGOROT = 4000;
export const DEFAULT_BLOCK_AGOROT = 4500;
/** ברירת המחדל למייל מנהל-העל, זהה לברירת המחדל של PLATFORM_ADMIN_EMAILS. */
export const DEFAULT_SUPER_ADMIN_EMAIL = 'yanivgolt@gmail.com';

/** מפת משתני סביבה (חלקית) שממנה נגזרת התצורה. */
export type WhatsAppEnv = Record<string, string | undefined>;

/** תצורת ערוץ הוואטסאפ, מנורמלת ומוכנה לשימוש. */
export interface WhatsAppConfig {
  /** מחרוזת החיבור ל-ACS (סוד), או undefined אם לא הוגדרה. */
  connectionString: string | undefined;
  /** מזהה ערוץ הוואטסאפ הרשום, או undefined אם לא הוגדר. */
  channelId: string | undefined;
  /** שמות התבניות המאושרות לכל סוג. undefined => אין תבנית מוגדרת לסוג זה. */
  templates: {
    otp: string | undefined;
    confirm: string | undefined;
    reminder: string | undefined;
  };
  /** קוד שפת התבניות (למשל he, en_US). */
  templateLang: string;
  /** תעריפים משוערים לפי סוג ההודעה (אגורות). */
  rates: {
    utility: number;
    auth: number;
    marketing: number;
  };
  /** ספי הממשל החודשיים (אגורות). */
  warnAgorot: number;
  blockAgorot: number;
  /** יעד מיילי ההתראה על חריגה (מנהל-על). */
  superAdminEmail: string;
}

/** קורא מספר שלם אי-שלילי ממשתנה סביבה, עם ברירת מחדל בכשל/היעדר. */
function readIntAgorot(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** מנרמל ערך מחרוזת: undefined/ריק => undefined, אחרת trimmed. */
function readStr(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  return v ? v : undefined;
}

/**
 * טוען את תצורת הוואטסאפ ממשתני הסביבה (ברירת מחדל process.env). טהורה וניתנת
 * לבדיקה. אינה זורקת — ערכים חסרים מקבלים ברירת מחדל או undefined (שער חי-ומוכן).
 */
export function loadWhatsAppConfig(env: WhatsAppEnv = process.env): WhatsAppConfig {
  const utility = readIntAgorot(env.WHATSAPP_UTILITY_RATE_AGOROT, DEFAULT_UTILITY_RATE_AGOROT);
  return {
    connectionString: readStr(env.ACS_CONNECTION_STRING),
    channelId: readStr(env.ACS_WHATSAPP_CHANNEL_ID),
    templates: {
      otp: readStr(env.WA_TEMPLATE_OTP),
      confirm: readStr(env.WA_TEMPLATE_CONFIRM),
      reminder: readStr(env.WA_TEMPLATE_REMINDER),
    },
    templateLang: readStr(env.WA_TEMPLATE_LANG) ?? 'he',
    rates: {
      utility,
      // תעריף auth/marketing נופל חזרה לתעריף ה-utility כשלא הוגדר במפורש.
      auth: readIntAgorot(env.WHATSAPP_AUTH_RATE_AGOROT, utility),
      marketing: readIntAgorot(env.WHATSAPP_MARKETING_RATE_AGOROT, utility),
    },
    warnAgorot: readIntAgorot(env.WHATSAPP_MONTHLY_WARN_AGOROT, DEFAULT_WARN_AGOROT),
    blockAgorot: readIntAgorot(env.WHATSAPP_MONTHLY_BLOCK_AGOROT, DEFAULT_BLOCK_AGOROT),
    superAdminEmail:
      readStr(env.SUPER_ADMIN_EMAIL) ??
      // עקביות עם platformAdmin: הראשון ברשימת PLATFORM_ADMIN_EMAILS, אחרת ברירת המחדל.
      readStr(env.PLATFORM_ADMIN_EMAILS)?.split(',')[0]?.trim() ??
      DEFAULT_SUPER_ADMIN_EMAIL,
  };
}

/** בוחר את התעריף המשוער (אגורות) לפי סוג ההודעה. */
export function rateForType(config: WhatsAppConfig, type: WhatsAppMessageType): number {
  switch (type) {
    case 'OTP':
      return config.rates.auth;
    case 'CAMPAIGN':
      return config.rates.marketing;
    case 'CONFIRMATION':
    case 'REMINDER':
    default:
      return config.rates.utility;
  }
}

/** בוחר את שם התבנית המתאים לסוג ההודעה (undefined אם אין). */
export function templateForType(
  config: WhatsAppConfig,
  type: WhatsAppMessageType,
): string | undefined {
  switch (type) {
    case 'OTP':
      return config.templates.otp;
    case 'CONFIRMATION':
      return config.templates.confirm;
    case 'REMINDER':
      return config.templates.reminder;
    case 'CAMPAIGN':
    default:
      return undefined;
  }
}

/**
 * האם הטרנספורט (ACS) בכלל זמין — כלומר מחרוזת החיבור מוגדרת. בלי זה אין אפשרות
 * לבנות NotificationMessagesClient, ולכן כל שליחה תדולג (SKIPPED).
 */
export function transportAvailable(config: WhatsAppConfig): boolean {
  return Boolean(config.connectionString);
}

/**
 * האם שליחה אמיתית מופעלת — כלומר גם מחרוזת החיבור וגם מזהה הערוץ מוגדרים. זהו
 * שער החי-ומוכן: כאשר false, השרשרת עדיין רצה (לוג/עלות/ספים) אך השליחה מדולגת.
 */
export function liveSendingEnabled(config: WhatsAppConfig): boolean {
  return Boolean(config.connectionString && config.channelId);
}
