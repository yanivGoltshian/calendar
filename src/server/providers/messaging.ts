import { BRAND } from '@/config/brand';

/**
 * שכבת הודעות אגנוסטית-ערוץ.
 *
 * זו נקודת הכניסה הציבורית והיציבה לשליחת הודעות יוצאות במערכת (SMS,
 * WhatsApp ו-OTP הבנוי מעליהם). סשנים אחרים (למשל תזכורות) מייבאים מכאן,
 * ולכן הממשק הציבורי נשמר יציב ונקי. הבחירה בספק נעשית לפי משתנה הסביבה
 * `SMS_PROVIDER`.
 *
 * שמות משתני הסביבה (ראו .env.example ו-docs/deployment-cost.md):
 *
 *   בחירת ספק:
 *     SMS_PROVIDER = console | twilio | httpgateway   (ברירת מחדל: console)
 *
 *   Twilio (SMS + WhatsApp דרך REST):
 *     TWILIO_ACCOUNT_SID
 *     TWILIO_AUTH_TOKEN
 *     TWILIO_MESSAGING_SERVICE_SID   (או TWILIO_FROM)
 *     TWILIO_FROM                    (מספר שולח ל-SMS, אם אין Messaging Service)
 *     TWILIO_WHATSAPP_FROM           (whatsapp:+... ; רשות, אחרת נגזר מ-TWILIO_FROM)
 *
 *   שער ישראלי גנרי מבוסס HTTP (SMS):
 *     SMS_GATEWAY_PRESET   = generic | 019 | inforu   (ברירת מחדל: generic)
 *     SMS_GATEWAY_ENDPOINT = כתובת ה-HTTP endpoint
 *     SMS_GATEWAY_METHOD   = POST | GET               (ברירת מחדל: POST)
 *     SMS_GATEWAY_AUTH_MODE = none | bearer | basic | header   (ברירת מחדל: none)
 *     SMS_GATEWAY_TOKEN     = טוקן (ל-bearer / header)
 *     SMS_GATEWAY_USERNAME  = שם משתמש (ל-basic)
 *     SMS_GATEWAY_PASSWORD  = סיסמה (ל-basic)
 *     SMS_GATEWAY_AUTH_HEADER = שם ה-header (ל-header, ברירת מחדל: Authorization)
 *     SMS_GATEWAY_FROM      = שם/מספר השולח
 *     SMS_GATEWAY_TO_FIELD   = שם שדה הנמען ב-payload   (ברירת מחדל: to)
 *     SMS_GATEWAY_TEXT_FIELD = שם שדה הטקסט ב-payload    (ברירת מחדל: text)
 *     SMS_GATEWAY_FROM_FIELD = שם שדה השולח ב-payload    (ברירת מחדל: from)
 *     SMS_GATEWAY_EXTRA_JSON = JSON סטטי שיתמזג ל-payload (לשדות ספציפיים לספק)
 *
 * לעולם אין להטמיע סודות בקוד. כל הקרדנשלס מגיעים ממשתני סביבה בלבד.
 */

/** ערוצי המסירה הנתמכים. */
export type MessageChannel = 'sms' | 'whatsapp';

/**
 * ממשק ספק ההודעות. כל מתאם ערוץ (console/twilio/שער) מממש אותו.
 * זהו החוזה הציבורי שסשנים אחרים מסתמכים עליו.
 */
export interface MessagingProvider {
  /** מזהה קריא של הספק, לצורכי לוג ובדיקות. */
  readonly name: string;
  /** שליחת SMS פשוט. */
  sendSms(to: string, message: string): Promise<void>;
  /** שליחת הודעת WhatsApp. */
  sendWhatsApp(to: string, message: string): Promise<void>;
  /** שליחת קוד OTP בערוץ ברירת המחדל (SMS). בנוי מעל sendSms. */
  sendOtp(to: string, code: string): Promise<void>;
}

/**
 * שגיאת תצורה של שכבת ההודעות. נזרקת כשהספק אינו כשיר לשלוח בפועל
 * (למשל `console` בפרודקשן, או חוסר בקרדנשלס). ה-API אמור לתפוס אותה,
 * לרשום ללוג השרת, ולהחזיר שגיאה מטופלת עם הודעת i18n גנרית למשתמש.
 */
export class MessagingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingConfigError';
  }
}

/**
 * שגיאת שליחה בפועל (כשל רשת/דחייה מצד הספק). נזרקת ממתאם אמיתי
 * כאשר קריאת ה-REST נכשלה.
 */
export class MessagingSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingSendError';
  }
}

/** מבנה משתני הסביבה הרלוונטיים לשכבת ההודעות. */
export type MessagingEnv = Record<string, string | undefined>;

function isProduction(env: MessagingEnv): boolean {
  return env.NODE_ENV === 'production';
}

/** הרכבת הודעת ה-OTP הסטנדרטית. */
export function buildOtpMessage(code: string): string {
  return `${BRAND.name}: קוד האימות שלך הוא ${code}`;
}

// ---------- מתאם console (פיתוח בלבד) ----------

/**
 * מתאם פיתוח: כותב את ההודעה ללוג השרת בלבד ואינו שולח דבר.
 * מיועד לפיתוח מקומי בלבד. בפרודקשן resolveMessagingProvider ימנע בחירה בו.
 */
export class ConsoleMessagingProvider implements MessagingProvider {
  readonly name = 'console';

  private log(channel: MessageChannel, to: string, message: string): void {
    // eslint-disable-next-line no-console
    console.log(`\n📱 [${channel.toUpperCase()} → ${to}]\n${message}\n`);
  }

  async sendSms(to: string, message: string): Promise<void> {
    this.log('sms', to, message);
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    this.log('whatsapp', to, message);
  }

  async sendOtp(to: string, code: string): Promise<void> {
    // באנר בולט ללוג הפיתוח, רק כשלא בפרודקשן.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `\n════════════════════════════════════\n📱 קוד אימות ל-${to}: ${code}\n════════════════════════════════════\n`,
      );
    }
    await this.sendSms(to, buildOtpMessage(code));
  }
}

// ---------- מתאם Twilio (SMS + WhatsApp דרך REST) ----------

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  from?: string;
  whatsAppFrom?: string;
}

/** נרמול מספר ל-whatsapp:+... כפי ש-Twilio מצפה. */
function toWhatsAppAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

/**
 * מתאם Twilio. שולח SMS ו-WhatsApp דרך Messages REST API.
 * ה-fetch מוזרק לצורכי בדיקה (ברירת מחדל: fetch הגלובלי).
 */
export class TwilioMessagingProvider implements MessagingProvider {
  readonly name = 'twilio';
  private readonly config: TwilioConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TwilioConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private async post(params: Record<string, string>): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      this.config.accountSid,
    )}/Messages.json`;
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64',
    );
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });
    } catch (err) {
      throw new MessagingSendError(`Twilio request failed: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new MessagingSendError(`Twilio responded ${res.status}: ${detail}`);
    }
  }

  private smsSender(): Record<string, string> {
    if (this.config.messagingServiceSid) {
      return { MessagingServiceSid: this.config.messagingServiceSid };
    }
    if (this.config.from) {
      return { From: this.config.from };
    }
    throw new MessagingConfigError('Twilio: missing TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM');
  }

  async sendSms(to: string, message: string): Promise<void> {
    await this.post({ ...this.smsSender(), To: to, Body: message });
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    const from =
      this.config.whatsAppFrom ??
      (this.config.from ? toWhatsAppAddress(this.config.from) : undefined);
    if (!from) {
      throw new MessagingConfigError(
        'Twilio WhatsApp: missing TWILIO_WHATSAPP_FROM or TWILIO_FROM',
      );
    }
    await this.post({
      From: toWhatsAppAddress(from),
      To: toWhatsAppAddress(to),
      Body: message,
    });
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.sendSms(to, buildOtpMessage(code));
  }
}

// ---------- מתאם שער ישראלי גנרי מבוסס HTTP ----------

export type GatewayAuthMode = 'none' | 'bearer' | 'basic' | 'header';

export interface HttpGatewayConfig {
  endpoint: string;
  method: 'POST' | 'GET';
  authMode: GatewayAuthMode;
  token?: string;
  username?: string;
  password?: string;
  authHeader: string;
  from?: string;
  toField: string;
  textField: string;
  fromField: string;
  extra: Record<string, unknown>;
}

/** פריסטים לשערים ישראליים נפוצים. ניתנים לדריסה מלאה ב-env. */
const GATEWAY_PRESETS: Record<string, Partial<HttpGatewayConfig>> = {
  generic: {},
  // 019 SMS: משתמשים בדרך כלל ב-JSON עם טוקן ב-header. אמתו מול תיעוד הספק העדכני.
  '019': {
    method: 'POST',
    authMode: 'bearer',
    toField: 'phone',
    textField: 'message',
    fromField: 'source',
  },
  // InforU: JSON עם אימות Basic. אמתו מול תיעוד הספק העדכני.
  inforu: {
    method: 'POST',
    authMode: 'basic',
    toField: 'recipients',
    textField: 'message',
    fromField: 'sender',
  },
};

/**
 * מתאם שער HTTP גנרי. מבנה ה-endpoint, האימות וה-payload נקבעים ב-env,
 * עם פריסטים ל-019 ול-InforU. שולח JSON. WhatsApp אינו נתמך בשער זה.
 */
export class HttpGatewayMessagingProvider implements MessagingProvider {
  readonly name = 'httpgateway';
  private readonly config: HttpGatewayConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpGatewayConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private authHeaders(): Record<string, string> {
    const { authMode, token, username, password, authHeader } = this.config;
    switch (authMode) {
      case 'bearer':
        return token ? { Authorization: `Bearer ${token}` } : {};
      case 'basic': {
        const basic = Buffer.from(`${username ?? ''}:${password ?? ''}`).toString('base64');
        return { Authorization: `Basic ${basic}` };
      }
      case 'header':
        return token ? { [authHeader]: token } : {};
      case 'none':
      default:
        return {};
    }
  }

  async sendSms(to: string, message: string): Promise<void> {
    const payload: Record<string, unknown> = {
      ...this.config.extra,
      [this.config.toField]: to,
      [this.config.textField]: message,
    };
    if (this.config.from) {
      payload[this.config.fromField] = this.config.from;
    }

    let res: Response;
    try {
      res = await this.fetchImpl(this.config.endpoint, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.authHeaders(),
        },
        body: this.config.method === 'GET' ? undefined : JSON.stringify(payload),
      });
    } catch (err) {
      throw new MessagingSendError(`SMS gateway request failed: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new MessagingSendError(`SMS gateway responded ${res.status}: ${detail}`);
    }
  }

  async sendWhatsApp(_to: string, _message: string): Promise<void> {
    throw new MessagingConfigError('httpgateway provider does not support WhatsApp');
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.sendSms(to, buildOtpMessage(code));
  }
}

// ---------- בחירת ספק ----------

function parseExtraJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new MessagingConfigError('SMS_GATEWAY_EXTRA_JSON is not valid JSON');
  }
}

function buildTwilioProvider(env: MessagingEnv, fetchImpl?: typeof fetch): TwilioMessagingProvider {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  const from = env.TWILIO_FROM;

  if (!accountSid || !authToken) {
    throw new MessagingConfigError(
      'Twilio provider selected but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are missing',
    );
  }
  if (!messagingServiceSid && !from) {
    throw new MessagingConfigError(
      'Twilio provider selected but neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_FROM is set',
    );
  }

  return new TwilioMessagingProvider(
    {
      accountSid,
      authToken,
      messagingServiceSid,
      from,
      whatsAppFrom: env.TWILIO_WHATSAPP_FROM,
    },
    fetchImpl,
  );
}

function buildHttpGatewayProvider(
  env: MessagingEnv,
  fetchImpl?: typeof fetch,
): HttpGatewayMessagingProvider {
  const presetKey = (env.SMS_GATEWAY_PRESET ?? 'generic').toLowerCase();
  const preset = GATEWAY_PRESETS[presetKey];
  if (!preset) {
    throw new MessagingConfigError(
      `Unknown SMS_GATEWAY_PRESET "${presetKey}" (expected generic | 019 | inforu)`,
    );
  }

  const endpoint = env.SMS_GATEWAY_ENDPOINT;
  if (!endpoint) {
    throw new MessagingConfigError('httpgateway provider selected but SMS_GATEWAY_ENDPOINT is missing');
  }

  const method = (env.SMS_GATEWAY_METHOD ?? preset.method ?? 'POST').toUpperCase();
  if (method !== 'POST' && method !== 'GET') {
    throw new MessagingConfigError(`Unsupported SMS_GATEWAY_METHOD "${method}"`);
  }

  const authMode = (env.SMS_GATEWAY_AUTH_MODE ?? preset.authMode ?? 'none').toLowerCase();
  if (!['none', 'bearer', 'basic', 'header'].includes(authMode)) {
    throw new MessagingConfigError(`Unsupported SMS_GATEWAY_AUTH_MODE "${authMode}"`);
  }

  const config: HttpGatewayConfig = {
    endpoint,
    method: method as 'POST' | 'GET',
    authMode: authMode as GatewayAuthMode,
    token: env.SMS_GATEWAY_TOKEN,
    username: env.SMS_GATEWAY_USERNAME,
    password: env.SMS_GATEWAY_PASSWORD,
    authHeader: env.SMS_GATEWAY_AUTH_HEADER ?? 'Authorization',
    from: env.SMS_GATEWAY_FROM,
    toField: env.SMS_GATEWAY_TO_FIELD ?? preset.toField ?? 'to',
    textField: env.SMS_GATEWAY_TEXT_FIELD ?? preset.textField ?? 'text',
    fromField: env.SMS_GATEWAY_FROM_FIELD ?? preset.fromField ?? 'from',
    extra: parseExtraJson(env.SMS_GATEWAY_EXTRA_JSON),
  };

  if (authMode === 'basic' && (!config.username || !config.password)) {
    throw new MessagingConfigError(
      'httpgateway basic auth selected but SMS_GATEWAY_USERNAME / SMS_GATEWAY_PASSWORD are missing',
    );
  }
  if ((authMode === 'bearer' || authMode === 'header') && !config.token) {
    throw new MessagingConfigError(
      'httpgateway bearer/header auth selected but SMS_GATEWAY_TOKEN is missing',
    );
  }

  return new HttpGatewayMessagingProvider(config, fetchImpl);
}

/**
 * בחירת ספק ההודעות לפי משתני הסביבה. פונקציה טהורה (ללא סינגלטון) לצורכי
 * בדיקה והזרקת תלות. זורקת MessagingConfigError בכל מצב שאינו כשיר לשליחה
 * אמיתית: ספק לא מוכר, קרדנשלס חסרים, או `console`/חוסר קרדנשלס בפרודקשן.
 *
 * @param env משתני הסביבה (ברירת מחדל: process.env)
 * @param fetchImpl מימוש fetch להזרקה בבדיקות
 */
export function resolveMessagingProvider(
  env: MessagingEnv = process.env,
  fetchImpl?: typeof fetch,
): MessagingProvider {
  const selected = (env.SMS_PROVIDER ?? 'console').toLowerCase();

  switch (selected) {
    case 'twilio':
      return buildTwilioProvider(env, fetchImpl);
    case 'httpgateway':
    case 'gateway':
      return buildHttpGatewayProvider(env, fetchImpl);
    case 'console':
    case '':
      if (isProduction(env)) {
        throw new MessagingConfigError(
          'SMS_PROVIDER is "console" in production; configure a real provider (twilio or httpgateway)',
        );
      }
      return new ConsoleMessagingProvider();
    default:
      throw new MessagingConfigError(
        `Unknown SMS_PROVIDER "${selected}" (expected console | twilio | httpgateway)`,
      );
  }
}

let cached: MessagingProvider | null = null;

/**
 * ספק ההודעות הפעיל (סינגלטון), נבחר לפי משתני הסביבה. זורק
 * MessagingConfigError אם התצורה אינה כשירה לשליחה אמיתית.
 */
export function getMessagingProvider(): MessagingProvider {
  if (cached) return cached;
  cached = resolveMessagingProvider();
  return cached;
}

/** איפוס הסינגלטון (לצורכי בדיקה בלבד). */
export function resetMessagingProvider(): void {
  cached = null;
}

// ---------- פונקציות נוחות ציבוריות ----------

/** שליחת SMS דרך הספק הפעיל. */
export async function sendSms(to: string, text: string): Promise<void> {
  await getMessagingProvider().sendSms(to, text);
}

/** שליחת הודעת WhatsApp דרך הספק הפעיל. */
export async function sendWhatsApp(to: string, text: string): Promise<void> {
  await getMessagingProvider().sendWhatsApp(to, text);
}

/** שליחת קוד OTP דרך הספק הפעיל. */
export async function sendOtp(to: string, code: string): Promise<void> {
  await getMessagingProvider().sendOtp(to, code);
}
