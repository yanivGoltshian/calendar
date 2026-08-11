import { BRAND } from '@/config/brand';

/**
 * שכבת הודעות אגנוסטית-ערוץ.
 *
 * ממשק ציבורי יציב: sendSms / sendWhatsApp / sendOtp. סשנים אחרים (למשל
 * התזכורות) מיַבְּאים את השכבה הזו ולא מדברים מול ספק ההודעות ישירות.
 *
 * בחירת המתאם לפי משתנה הסביבה MESSAGING_PROVIDER (עם תאימות לאחור ל-
 * SMS_PROVIDER). ברירת המחדל היא console (פיתוח בלבד, רק לוג). המתאם האמיתי
 * הוא whatsapp-cloud מול WhatsApp Cloud API של מטא (Graph API).
 *
 * ערכים אפשריים ל-MESSAGING_PROVIDER:
 *   console         - הדפסה ללוג בלבד (ברירת מחדל לפיתוח).
 *   whatsapp-cloud  - WhatsApp Cloud API של מטא (aliases: whatsapp, whatsapp_cloud).
 *
 * משתני הסביבה של whatsapp-cloud:
 *   WHATSAPP_PHONE_NUMBER_ID     (חובה) מזהה מספר השולח ב-WhatsApp Cloud.
 *   WHATSAPP_ACCESS_TOKEN        (חובה, סוד) טוקן Graph API.
 *   WHATSAPP_OTP_TEMPLATE        (חובה) שם תבנית מאושרת מסוג authentication.
 *   WHATSAPP_BUSINESS_ACCOUNT_ID (אופציונלי) מזהה ה-WABA, לרפרנס/לוג.
 *   WHATSAPP_OTP_TEMPLATE_LANG   (אופציונלי, ברירת מחדל he) קוד שפת התבנית;
 *                                חייב להתאים לשפת התבנית המאושרת (למשל he, en_US).
 *   WHATSAPP_OTP_BUTTON_SUBTYPE  (אופציונלי, ברירת מחדל url) sub_type של כפתור
 *                                העתקת הקוד בתבנית authentication; none/ריק משמיט
 *                                את רכיב הכפתור (לתבניות בלי כפתור).
 *   WHATSAPP_GRAPH_VERSION       (אופציונלי, ברירת מחדל v21.0) גרסת Graph API.
 *   WHATSAPP_GRAPH_BASE_URL      (אופציונלי, ברירת מחדל https://graph.facebook.com).
 *   WHATSAPP_DEFAULT_COUNTRY_CODE(אופציונלי, ברירת מחדל 972) קידומת מדינה עבור
 *                                מספרים בפורמט מקומי (0...).
 *
 * הערה: whatsapp-cloud הוא ספק WhatsApp בלבד. sendSms נמסר גם הוא דרך WhatsApp
 * (אין ערוץ SMS בתשלום). התפר ל-sendSms נשמר נקי כדי שאדפטר SMS ייעודי עתידי
 * יוכל לממש SMS אמיתי בלי לשנות את הממשק.
 */

/** ערוצי המסירה הנתמכים על ידי שכבת ההודעות. */
export type MessageChannel = 'sms' | 'whatsapp';

/**
 * ממשק ספק ההודעות. כל מתאם (console / whatsapp-cloud / אדפטר עתידי) מממש אותו.
 */
export interface MessagingProvider {
  /** שם קריא של המתאם, לצורכי לוג ואבחון. */
  readonly name: string;
  /** שליחת הודעת טקסט חופשי בערוץ SMS. */
  sendSms(to: string, message: string): Promise<void>;
  /** שליחת הודעת טקסט חופשי בערוץ WhatsApp. */
  sendWhatsApp(to: string, message: string): Promise<void>;
  /** שליחת קוד OTP בן שש ספרות (בנוי מעל ערוצי הבסיס). */
  sendOtp(to: string, code: string): Promise<void>;
}

/**
 * שגיאת תצורה: הספק לא הוגדר כראוי (למשל console בפרודקשן, או קרדנשלס חסרים).
 * גורמת לכשל רועש במקום הצלחה שקטה.
 */
export class MessagingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingConfigError';
  }
}

/**
 * שגיאת שליחה: הספק הוגדר אך המסירה בפועל נכשלה (שגיאת רשת או תגובת שגיאה).
 */
export class MessagingSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingSendError';
  }
}

/** מפת משתני סביבה (חלקית) שממנה נגזרת בחירת הספק ותצורתו. */
export type MessagingEnv = Record<string, string | undefined>;

/** האם רצים בפרודקשן (קובע כשל-רועש ורמזי פיתוח). */
function isProduction(env: MessagingEnv): boolean {
  return (env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/** בניית נוסח הודעת ה-OTP הגנרית (כאשר אין תבנית ייעודית, למשל ב-console). */
export function buildOtpMessage(code: string): string {
  return `${BRAND.name}: קוד האימות שלך הוא ${code}`;
}

// ---------------------------------------------------------------------------
// מתאם console: פיתוח בלבד. רק כותב ללוג, לעולם לא שולח בפועל.
// ---------------------------------------------------------------------------
export class ConsoleMessagingProvider implements MessagingProvider {
  readonly name = 'console';

  private log(channel: MessageChannel, to: string, message: string): void {
    // לוג שרת בלבד, לא נחשף ללקוח.
    console.info(`[messaging:console] (${channel}) -> ${to}: ${message}`);
  }

  async sendSms(to: string, message: string): Promise<void> {
    this.log('sms', to, message);
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    this.log('whatsapp', to, message);
  }

  async sendOtp(to: string, code: string): Promise<void> {
    this.log('whatsapp', to, buildOtpMessage(code));
    // באנר פיתוח בולט, רק כשלא בפרודקשן, כדי לא לדלוף קוד בסביבת אמת.
    if (!isProduction(process.env)) {
      console.info(
        `\n============================\n[DEV OTP] ${to} -> ${code}\n============================\n`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// מתאם whatsapp-cloud: WhatsApp Cloud API של מטא (Graph API). הספק הראשי.
// ---------------------------------------------------------------------------
export interface WhatsAppCloudConfig {
  /** מזהה מספר השולח (WHATSAPP_PHONE_NUMBER_ID). */
  phoneNumberId: string;
  /** טוקן Graph API (סוד). */
  accessToken: string;
  /** מזהה ה-WABA, אופציונלי, לרפרנס בלבד. */
  businessAccountId?: string;
  /** שם תבנית ה-OTP מסוג authentication. */
  otpTemplate: string;
  /** קוד שפת התבנית (למשל he, en_US). */
  otpTemplateLang: string;
  /** sub_type של כפתור העתקת הקוד, או null כדי להשמיט אותו. */
  otpButtonSubType: string | null;
  /** גרסת Graph API (למשל v21.0). */
  graphVersion: string;
  /** בסיס כתובת Graph (למשל https://graph.facebook.com). */
  baseUrl: string;
  /** קידומת מדינה למספרים בפורמט מקומי (למשל 972). */
  defaultCountryCode: string;
}

export class WhatsAppCloudProvider implements MessagingProvider {
  readonly name = 'whatsapp-cloud';
  private readonly config: WhatsAppCloudConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: WhatsAppCloudConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /** נורמליזציה של מספר היעד לפורמט WhatsApp (ספרות בלבד, ללא +). */
  private toRecipient(to: string): string {
    const digits = to.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return `${this.config.defaultCountryCode}${digits.slice(1)}`;
    }
    return digits;
  }

  /** שליחת payload ל-Graph API עם טיפול בשגיאות רשת ותגובות שגיאה. */
  private async post(payload: Record<string, unknown>): Promise<void> {
    const url = `${this.config.baseUrl}/${this.config.graphVersion}/${encodeURIComponent(
      this.config.phoneNumberId,
    )}/messages`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new MessagingSendError(
        `WhatsApp Cloud request failed: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new MessagingSendError(
        `WhatsApp Cloud responded ${res.status}: ${detail}`,
      );
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.toRecipient(to),
      type: 'text',
      text: { preview_url: false, body: message },
    });
  }

  async sendSms(to: string, message: string): Promise<void> {
    // whatsapp-cloud מדבר WhatsApp בלבד; אין ערוץ SMS בתשלום. הודעות טקסט
    // כלליות נמסרות דרך WhatsApp כדי לא לשבור צרכנים קיימים של sendSms.
    await this.sendWhatsApp(to, message);
  }

  async sendOtp(to: string, code: string): Promise<void> {
    const components: Array<Record<string, unknown>> = [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
    ];
    if (this.config.otpButtonSubType) {
      components.push({
        type: 'button',
        sub_type: this.config.otpButtonSubType,
        index: '0',
        parameters: [{ type: 'text', text: code }],
      });
    }
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.toRecipient(to),
      type: 'template',
      template: {
        name: this.config.otpTemplate,
        language: { code: this.config.otpTemplateLang },
        components,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// בחירת ספק: קורא MESSAGING_PROVIDER (עם תאימות לאחור ל-SMS_PROVIDER).
// ---------------------------------------------------------------------------

/** בניית מתאם whatsapp-cloud מתוך משתני הסביבה; זורק אם חסרים קרדנשלס. */
function buildWhatsAppCloudProvider(
  env: MessagingEnv,
  fetchImpl?: typeof fetch,
): MessagingProvider {
  const phoneNumberId = (env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
  const accessToken = (env.WHATSAPP_ACCESS_TOKEN ?? '').trim();
  const otpTemplate = (env.WHATSAPP_OTP_TEMPLATE ?? '').trim();

  const missing: string[] = [];
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!otpTemplate) missing.push('WHATSAPP_OTP_TEMPLATE');
  if (missing.length > 0) {
    throw new MessagingConfigError(
      `whatsapp-cloud provider selected but missing required env: ${missing.join(', ')}`,
    );
  }

  const buttonRaw = (env.WHATSAPP_OTP_BUTTON_SUBTYPE ?? 'url').trim().toLowerCase();
  const otpButtonSubType = buttonRaw === '' || buttonRaw === 'none' ? null : buttonRaw;
  const defaultCountryCode =
    (env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? '972').replace(/\D/g, '') || '972';
  const baseUrl = (env.WHATSAPP_GRAPH_BASE_URL ?? 'https://graph.facebook.com')
    .trim()
    .replace(/\/+$/, '');

  return new WhatsAppCloudProvider(
    {
      phoneNumberId,
      accessToken,
      businessAccountId: (env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '').trim() || undefined,
      otpTemplate,
      otpTemplateLang: (env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'he').trim() || 'he',
      otpButtonSubType,
      graphVersion: (env.WHATSAPP_GRAPH_VERSION ?? 'v21.0').trim() || 'v21.0',
      baseUrl: baseUrl || 'https://graph.facebook.com',
      defaultCountryCode,
    },
    fetchImpl,
  );
}

/**
 * מזהה ובונה את ספק ההודעות מתוך משתני הסביבה. ניתן להזריק env ו-fetch לבדיקות.
 * ברירת המחדל console; בפרודקשן console/ריק זורק MessagingConfigError (כשל רועש).
 */
export function resolveMessagingProvider(
  env: MessagingEnv = process.env,
  fetchImpl?: typeof fetch,
): MessagingProvider {
  const selected = (env.MESSAGING_PROVIDER ?? env.SMS_PROVIDER ?? 'console')
    .trim()
    .toLowerCase();

  switch (selected) {
    case 'whatsapp-cloud':
    case 'whatsapp_cloud':
    case 'whatsapp':
      return buildWhatsAppCloudProvider(env, fetchImpl);
    case 'console':
    case '':
      if (isProduction(env)) {
        throw new MessagingConfigError(
          'MESSAGING_PROVIDER is "console" in production; configure a real provider (whatsapp-cloud)',
        );
      }
      return new ConsoleMessagingProvider();
    default:
      throw new MessagingConfigError(
        `Unknown MESSAGING_PROVIDER "${selected}" (expected console | whatsapp-cloud)`,
      );
  }
}

// ---------------------------------------------------------------------------
// סינגלטון נוח + פונקציות עזר ציבוריות.
// ---------------------------------------------------------------------------
let cachedProvider: MessagingProvider | null = null;

/** מחזיר את ספק ההודעות (סינגלטון), בונה בפעם הראשונה. */
export function getMessagingProvider(): MessagingProvider {
  if (!cachedProvider) {
    cachedProvider = resolveMessagingProvider();
  }
  return cachedProvider;
}

/** איפוס הסינגלטון (לשימוש בבדיקות). */
export function resetMessagingProvider(): void {
  cachedProvider = null;
}

/** שליחת SMS דרך הספק הפעיל. */
export function sendSms(to: string, message: string): Promise<void> {
  return getMessagingProvider().sendSms(to, message);
}

/** שליחת WhatsApp דרך הספק הפעיל. */
export function sendWhatsApp(to: string, message: string): Promise<void> {
  return getMessagingProvider().sendWhatsApp(to, message);
}

/** שליחת OTP דרך הספק הפעיל. */
export function sendOtp(to: string, code: string): Promise<void> {
  return getMessagingProvider().sendOtp(to, code);
}
