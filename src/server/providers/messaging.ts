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
 *   sms4free        - שער מסרונים ישראלי אמיתי api.sms4free.co.il (aliases: sms-il, sms_il).
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
 * משתני הסביבה של sms4free (כולם בשרת בלבד, המפתח והסיסמה הם סוד):
 *   SMS4FREE_API_KEY       (חובה, סוד) מפתח ה-API של החשבון.
 *   SMS4FREE_USER          (חובה) שם המשתמש בחשבון (בדרך כלל מספר הבעלים).
 *   SMS4FREE_PASS          (חובה, סוד) סיסמת החשבון.
 *   SMS4FREE_SENDER        (חובה) שם או מספר השולח שמוצג לנמען.
 *   SMS4FREE_BASE_URL      (אופציונלי, ברירת מחדל https://api.sms4free.co.il).
 *   SMS4FREE_SEND_PATH     (אופציונלי, ברירת מחדל /ApiSMS/v2/SendSMS) נתיב השליחה;
 *                          ניתן לעקיפה ל-/ApiSMS/SendSMS עבור הגרסה הישנה.
 *   SMS_DEFAULT_COUNTRY_CODE(אופציונלי, ברירת מחדל 972) קידומת לנרמול מספרים
 *                          בין-לאומיים חזרה למבנה מקומי (05...).
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
// מתאם sms4free: שער מסרונים ישראלי אמיתי (api.sms4free.co.il). ערוץ ה-SMS
// האופרטיבי. המפתח, שם המשתמש, והסיסמה חיים בשרת בלבד (סוד), לעולם לא בצד הלקוח.
// ---------------------------------------------------------------------------

/** תצורת מתאם sms4free. כל השדות מגיעים ממשתני סביבה בשרת. */
export interface Sms4FreeConfig {
  /** מפתח ה-API של החשבון (סוד). */
  apiKey: string;
  /** שם המשתמש בחשבון (בדרך כלל מספר הטלפון של הבעלים). */
  user: string;
  /** סיסמת החשבון (סוד). */
  pass: string;
  /** שם או מספר השולח שמוצג לנמען. */
  sender: string;
  /** בסיס כתובת ה-API (למשל https://api.sms4free.co.il). */
  baseUrl: string;
  /** נתיב שליחת ההודעה (למשל /ApiSMS/v2/SendSMS). ניתן לעקיפה לגרסה ישנה. */
  sendPath: string;
  /** קידומת מדינה לנרמול מספרים בין-לאומיים חזרה למבנה מקומי (למשל 972). */
  defaultCountryCode: string;
}

/** תוצאת פענוח גוף התגובה של sms4free. */
export interface Sms4FreeResult {
  /** האם השליחה הצליחה (קוד חיובי או מזהה הודעה תקין). */
  ok: boolean;
  /** הקוד המספרי מהשער (חיובי = מספר הודעות, אפס/שלילי = שגיאה). */
  code: number;
  /** מזהה ההודעה מהספק, אם הוחזר (בעיקר בגרסת v2). */
  providerMessageId?: string;
  /** הודעת שגיאה קריאה, כשהשליחה נכשלה. */
  error?: string;
}

/** מיפוי קודי השגיאה של sms4free לטקסט קריא בעברית (מקור: תיעוד הספק). */
export function sms4freeErrorMessage(code: number): string {
  switch (code) {
    case 0:
      return 'שגיאה כללית מהשער';
    case -1:
      return 'מפתח, שם משתמש או סיסמה שגויים';
    case -2:
      return 'שם או מספר שולח ההודעה שגוי';
    case -3:
      return 'לא נמצאו נמענים';
    case -4:
      return 'יתרת ההודעות נמוכה מכדי לשלוח';
    case -5:
      return 'תוכן ההודעה אינו מתאים';
    case -6:
      return 'יש לאמת את מספר השולח מול הספק';
    default:
      return `שגיאה לא ידועה מהשער (קוד ${code})`;
  }
}

/**
 * פענוח גוף התגובה של sms4free. בגרסה הישנה השער מחזיר מספר שלם כטקסט, ובגרסת
 * v2 אובייקט JSON עם status ו-id. הפענוח סובלני לשני המבנים כדי לא להיתלות בגרסה.
 */
export function parseSms4FreeBody(rawText: string): Sms4FreeResult {
  const trimmed = (rawText ?? '').trim();
  let code = Number.NaN;
  let providerMessageId: string | undefined;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'number') {
      code = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const rawStatus = obj.status ?? obj.code;
      code = rawStatus === undefined ? Number.NaN : Number(rawStatus);
      const data = (obj.data ?? {}) as Record<string, unknown>;
      const rawId = obj.id ?? obj.messageId ?? data.messageId ?? data.id;
      providerMessageId =
        rawId === undefined || rawId === null ? undefined : String(rawId) || undefined;
    }
  } catch {
    code = Number.parseInt(trimmed, 10);
  }

  if (!Number.isNaN(code)) {
    return code > 0
      ? { ok: true, code, providerMessageId }
      : { ok: false, code, error: sms4freeErrorMessage(code) };
  }
  if (providerMessageId) {
    return { ok: true, code: 1, providerMessageId };
  }
  return {
    ok: false,
    code: 0,
    error: `תגובה לא צפויה מהשער: ${trimmed.slice(0, 120)}`,
  };
}

export class Sms4FreeProvider implements MessagingProvider {
  readonly name = 'sms4free';
  private readonly config: Sms4FreeConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Sms4FreeConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /** נרמול מספר היעד למבנה מקומי ישראלי (05...), כפי שהשער מצפה. */
  private toRecipient(to: string): string {
    let digits = (to ?? '').replace(/\D/g, '');
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }
    const cc = this.config.defaultCountryCode;
    if (cc && digits.startsWith(cc)) {
      return `0${digits.slice(cc.length)}`;
    }
    return digits;
  }

  /** שליחת מסרון בפועל דרך השער, והחזרת תוצאה מפוענחת (לתיעוד ומעקב עלות). */
  async sendSmsWithResult(to: string, message: string): Promise<Sms4FreeResult> {
    const url = `${this.config.baseUrl}${this.config.sendPath}`;
    const payload = {
      key: this.config.apiKey,
      user: this.config.user,
      pass: this.config.pass,
      sender: this.config.sender,
      recipient: this.toRecipient(to),
      msg: message,
    };

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new MessagingSendError(`sms4free request failed: ${(err as Error).message}`);
    }

    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      throw new MessagingSendError(`sms4free responded ${res.status}: ${bodyText}`);
    }

    const result = parseSms4FreeBody(bodyText);
    if (!result.ok) {
      throw new MessagingSendError(`sms4free send failed: ${result.error}`);
    }
    return result;
  }

  async sendSms(to: string, message: string): Promise<void> {
    await this.sendSmsWithResult(to, message);
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    // sms4free הוא ערוץ SMS בלבד ואין בו WhatsApp. כדי לא לשבור צרכני טקסט
    // קיימים (למשל ענף התזכורת המתויג SMS שקורא היום sendWhatsApp), הקריאה
    // נמסרת כ-SMS עד שניתוב הערוצים יאוחד סביב sendSms.
    await this.sendSms(to, message);
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.sendSms(to, buildOtpMessage(code));
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

/** בניית מתאם sms4free מתוך משתני הסביבה; זורק אם חסרים קרדנשלס. */
function buildSms4FreeProvider(
  env: MessagingEnv,
  fetchImpl?: typeof fetch,
): MessagingProvider {
  const apiKey = (env.SMS4FREE_API_KEY ?? '').trim();
  const user = (env.SMS4FREE_USER ?? '').trim();
  const pass = (env.SMS4FREE_PASS ?? '').trim();
  const sender = (env.SMS4FREE_SENDER ?? '').trim();

  const missing: string[] = [];
  if (!apiKey) missing.push('SMS4FREE_API_KEY');
  if (!user) missing.push('SMS4FREE_USER');
  if (!pass) missing.push('SMS4FREE_PASS');
  if (!sender) missing.push('SMS4FREE_SENDER');
  if (missing.length > 0) {
    throw new MessagingConfigError(
      `sms4free provider selected but missing required env: ${missing.join(', ')}`,
    );
  }

  const baseUrl = (env.SMS4FREE_BASE_URL ?? 'https://api.sms4free.co.il')
    .trim()
    .replace(/\/+$/, '');
  const rawPath = (env.SMS4FREE_SEND_PATH ?? '/ApiSMS/v2/SendSMS').trim();
  const sendPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const defaultCountryCode =
    (env.SMS_DEFAULT_COUNTRY_CODE ?? '972').replace(/\D/g, '') || '972';

  return new Sms4FreeProvider(
    {
      apiKey,
      user,
      pass,
      sender,
      baseUrl: baseUrl || 'https://api.sms4free.co.il',
      sendPath,
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
    case 'sms4free':
    case 'sms-il':
    case 'sms_il':
      return buildSms4FreeProvider(env, fetchImpl);
    case 'whatsapp-cloud':
    case 'whatsapp_cloud':
    case 'whatsapp':
      return buildWhatsAppCloudProvider(env, fetchImpl);
    case 'console':
    case '':
      if (isProduction(env)) {
        throw new MessagingConfigError(
          'MESSAGING_PROVIDER is "console" in production; configure a real provider (sms4free | whatsapp-cloud)',
        );
      }
      return new ConsoleMessagingProvider();
    default:
      throw new MessagingConfigError(
        `Unknown MESSAGING_PROVIDER "${selected}" (expected console | sms4free | whatsapp-cloud)`,
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
