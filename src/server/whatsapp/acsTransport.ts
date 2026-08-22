/**
 * שכבת התובלה מול Azure Communication Services — Advanced Messaging (וואטסאפ).
 *
 * עוטף את @azure/communication-messages (NotificationMessagesClient). ה-SDK נטען
 * דינמית בזמן ריצה (import עם מפרט משתנה) כדי ששכבת ה-build המקומית תתקמפל גם ללא
 * החבילה מותקנת, וכדי שהיעדר החבילה או הקונפיג בזמן ריצה ייפלו בחן ל"דילוג" במקום
 * להפיל את ה-build. שליחה אמיתית נדלקת ברגע שקיימים ACS_CONNECTION_STRING וגם
 * ACS_WHATSAPP_CHANNEL_ID ותבניות מאושרות.
 *
 * חשוב: מודול זה אינו נוגע ב-DB ואינו מטפל בעלות/ממשל — רק שולח ומחזיר תוצאה
 * אחידה. שכבת הערוץ (channel.ts) היא זו שרושמת יומן, צוברת עלות, ומטפלת בכשלים.
 */

import { normalizePhone } from '@/lib/crypto';
import type { WhatsAppConfig } from './config';

/** תוצאה אחידה של קריאת תובלה, ללא זריקת חריגה כלפי מעלה. */
export interface AcsSendResult {
  /** האם השליחה הצליחה מול ACS. */
  ok: boolean;
  /** מזהה ההודעה שהוחזר מהספק (לשמירה ביומן). */
  providerMessageId?: string;
  /** קוד שגיאה קצר לשמירה ביומן (errorCode). */
  errorCode?: string;
  /** תיאור שגיאה לצרכי לוג (לא נשמר כ-errorCode). */
  errorMessage?: string;
  /** דילוג (קונפיג/חבילה חסרים) — שונה מכשל אמיתי מול הספק. */
  skipped?: boolean;
}

/** פרמטרים לשליחת הודעת תבנית (Utility/Authentication). */
export interface TemplateSendParams {
  toPhone: string;
  templateName: string;
  /** קוד שפה של התבנית כפי שאושרה במטא (למשל 'he' או 'en_US'). */
  language: string;
  /** פרמטרים סדורים לגוף התבנית (body), לפי סדר ה-placeholders. */
  bodyParams?: string[];
}

/** פרמטרים לשליחת טקסט חופשי (חלון השיחה בן 24 השעות). */
export interface TextSendParams {
  toPhone: string;
  text: string;
}

/** ממשק מינימלי של ה-client, כדי לא להיצמד לטיפוסי החבילה בזמן קומפילציה. */
interface AcsMessagesClientLike {
  send(content: unknown): Promise<{ receipts?: Array<{ messageId?: string; to?: string }> }>;
}

// מטמון ה-client לפי מחרוזת החיבור, כדי לא לבנות לקוח חדש בכל שליחה.
let cachedClient: AcsMessagesClientLike | null = null;
let cachedFor: string | null = null;
let sdkMissingLogged = false;

/**
 * טוען דינמית את ה-SDK ובונה NotificationMessagesClient. מחזיר null אם חסרה
 * מחרוזת חיבור או שהחבילה אינה מותקנת (מצב "גייטד") — ללא זריקת חריגה.
 */
async function getClient(config: WhatsAppConfig): Promise<AcsMessagesClientLike | null> {
  const connectionString = config.connectionString;
  if (!connectionString) return null;

  if (cachedClient && cachedFor === connectionString) return cachedClient;

  try {
    // מפרט משתנה בכוונה: מונע מ-tsc/next לנסות לפתור את החבילה בזמן קומפילציה,
    // כך שה-build המקומי עובר גם כשהחבילה אינה מותקנת (feed פנימי חוסם אותה).
    const specifier = '@azure/communication-messages';
    const mod: unknown = await import(/* webpackIgnore: true */ specifier);
    const ClientCtor = (mod as Record<string, unknown>).NotificationMessagesClient as
      | (new (conn: string) => AcsMessagesClientLike)
      | undefined;
    if (!ClientCtor) {
      if (!sdkMissingLogged) {
        console.warn('[whatsapp:acs] NotificationMessagesClient לא נמצא בחבילת ה-SDK');
        sdkMissingLogged = true;
      }
      return null;
    }
    cachedClient = new ClientCtor(connectionString);
    cachedFor = connectionString;
    return cachedClient;
  } catch (err) {
    // החבילה לא מותקנת (מצב גייטד live-ready) — לא כשל אמיתי; מדלגים.
    if (!sdkMissingLogged) {
      console.warn(
        '[whatsapp:acs] חבילת @azure/communication-messages אינה זמינה — שליחת וואטסאפ מדולגת',
        err instanceof Error ? err.message : String(err),
      );
      sdkMissingLogged = true;
    }
    return null;
  }
}

/** ממפה חריגה של ה-SDK לקוד/תיאור שגיאה קצרים. */
function toErrorResult(err: unknown): AcsSendResult {
  const anyErr = err as { code?: unknown; statusCode?: unknown; message?: unknown } | null;
  const code =
    (anyErr && typeof anyErr.code === 'string' && anyErr.code) ||
    (anyErr && anyErr.statusCode != null && `HTTP_${String(anyErr.statusCode)}`) ||
    'ACS_SEND_ERROR';
  const message =
    anyErr && typeof anyErr.message === 'string' ? anyErr.message : 'שליחת וואטסאפ נכשלה';
  return { ok: false, errorCode: String(code), errorMessage: message };
}

/**
 * בונה את מבנה ה-bindings/values של תבנית וואטסאפ מפרמטרים סדורים של הגוף.
 * מייצר שמות placeholder יציבים (p1, p2, ...) וממפה אותם ל-body bindings בסדר.
 */
function buildTemplatePayload(
  channelRegistrationId: string,
  params: TemplateSendParams,
): Record<string, unknown> {
  const to = normalizePhone(params.toPhone);
  const bodyParams = params.bodyParams ?? [];
  const values = bodyParams.map((text, i) => ({ kind: 'text', name: `p${i + 1}`, text }));
  const body = bodyParams.map((_, i) => ({ refValue: `p${i + 1}` }));

  const template: Record<string, unknown> = {
    name: params.templateName,
    language: params.language,
  };
  if (values.length > 0) {
    template.values = values;
    template.bindings = { kind: 'whatsApp', body };
  }

  return {
    channelRegistrationId,
    to: [to],
    kind: 'template',
    template,
  };
}

/**
 * שולח הודעת תבנית מאושרת (Utility/Authentication) בערוץ הוואטסאפ.
 * מחזיר skipped=true אם הקונפיג/החבילה חסרים (מצב גייטד), ok=false עם errorCode
 * אם ACS החזיר שגיאה, ו-ok=true עם providerMessageId בהצלחה. לעולם אינו זורק.
 */
export async function sendTemplate(
  config: WhatsAppConfig,
  params: TemplateSendParams,
): Promise<AcsSendResult> {
  if (!config.channelId) return { ok: false, skipped: true, errorCode: 'CHANNEL_NOT_CONFIGURED' };
  const client = await getClient(config);
  if (!client) return { ok: false, skipped: true, errorCode: 'ACS_NOT_AVAILABLE' };

  try {
    const payload = buildTemplatePayload(config.channelId, params);
    const result = await client.send(payload);
    const messageId = result?.receipts?.[0]?.messageId;
    return { ok: true, providerMessageId: messageId };
  } catch (err) {
    return toErrorResult(err);
  }
}

/**
 * שולח טקסט חופשי בחלון השיחה (24ש). משמש בעיקר לקמפיינים כאשר קיים חלון פתוח.
 * זהה ל-sendTemplate בהתנהגות אי-הזריקה ובמצב הגייטד.
 */
export async function sendText(
  config: WhatsAppConfig,
  params: TextSendParams,
): Promise<AcsSendResult> {
  if (!config.channelId) return { ok: false, skipped: true, errorCode: 'CHANNEL_NOT_CONFIGURED' };
  const client = await getClient(config);
  if (!client) return { ok: false, skipped: true, errorCode: 'ACS_NOT_AVAILABLE' };

  try {
    const payload = {
      channelRegistrationId: config.channelId,
      to: [normalizePhone(params.toPhone)],
      kind: 'text',
      content: params.text,
    };
    const result = await client.send(payload);
    const messageId = result?.receipts?.[0]?.messageId;
    return { ok: true, providerMessageId: messageId };
  } catch (err) {
    return toErrorResult(err);
  }
}

/** איפוס המטמון — לשימוש בבדיקות בלבד. */
export function __resetAcsClientCacheForTests(): void {
  cachedClient = null;
  cachedFor = null;
  sdkMissingLogged = false;
}
