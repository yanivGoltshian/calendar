/**
 * מתאם וואטסאפ *ניתן להחלפה* להתראות לבעל האתר (Yaniv), מגודר משתני סביבה.
 *
 * בכוונה נפרד מספק ההודעות ללקוחות (src/server/providers/messaging.ts, שמבוסס
 * על Meta WhatsApp Cloud API): התראת הבעלים היא ערוץ פנימי, ולכן היא ממומשת
 * כמתאם עצמאי בעל ממשק אחיד (sendOwnerWhatsApp) שקל להחליף בעתיד.
 *
 * מימוש ברירת המחדל הוא Twilio WhatsApp, המופעל כאשר שלושת סודות Twilio קיימים:
 *   TWILIO_ACCOUNT_SID   מזהה החשבון ב-Twilio
 *   TWILIO_AUTH_TOKEN    אסימון האימות ב-Twilio
 *   TWILIO_WHATSAPP_FROM מספר השולח המאושר (עם או בלי הקידומת "whatsapp:")
 *
 * יעד ההתראה נקבע דרך OWNER_WHATSAPP_TO, ובהיעדרו נופל לברירת המחדל בקוד
 * (CONTACT.PHONE_E164, מספר הוואטסאפ האישי של בעל האתר) — כך שדי בהגדרת שלושת
 * הסודות כדי שההתראה תגיע ליעד הנכון, בלי צורך לחזור על המספר בכל סביבה.
 *
 * כשחסר אחד מסודות Twilio — המתאם *מדלג בחן*: מחזיר { sent:false, configured:false }
 * ומתעד ללוג, בלי לזרוק שגיאה. שליחת המייל וההתמדה במסד לעולם אינן תלויות בו.
 */

import { CONTACT } from '@/config/contact';

/**
 * יעד הוואטסאפ של בעל האתר: OWNER_WHATSAPP_TO, ובהיעדרו מספר הקשר בברירת המחדל
 * (CONTACT.PHONE_E164). ניתן להזין עם או בלי הקידומת "whatsapp:".
 */
export function ownerWhatsAppTo(): string {
  return process.env.OWNER_WHATSAPP_TO?.trim() || CONTACT.PHONE_E164;
}

/**
 * האם מתאם הוואטסאפ של הבעלים מוגדר: די בשלושת סודות Twilio, שכן יעד ההתראה
 * תמיד קיים (OWNER_WHATSAPP_TO או ברירת המחדל בקוד).
 */
export function whatsappOwnerConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim(),
  );
}

/** מוודא קידומת "whatsapp:" יחידה על מספר E.164 (כפי ש-Twilio מצפה). */
function toWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

export type OwnerWhatsAppResult = {
  /** האם ההודעה נשלחה בהצלחה דרך Twilio. */
  sent: boolean;
  /** האם המתאם מוגדר (כל משתני הסביבה קיימים). */
  configured: boolean;
  /** תקציר שגיאה אחרון, אם היה (לצרכי דיבוג בלבד). */
  error?: string;
};

/**
 * שליחת הודעת וואטסאפ לבעל האתר. לעולם אינו זורק שגיאה: מחזיר תוצאה מובנית
 * שהקורא מתעד ומתמיד. מדלג בחן כשהמתאם אינו מוגדר.
 */
export async function sendOwnerWhatsApp(message: string): Promise<OwnerWhatsAppResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  const to = ownerWhatsAppTo();

  if (!sid || !token || !from) {
    console.info('[whatsapp:owner] skipped — Twilio env not configured');
    return { sent: false, configured: false };
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      sid,
    )}/Messages.json`;
    const body = new URLSearchParams({
      From: toWhatsAppAddress(from),
      To: toWhatsAppAddress(to),
      Body: message,
    });
    // אימות בסיסי (Basic Auth) של Twilio: base64 של "sid:token".
    const auth =
      typeof btoa === 'function'
        ? btoa(`${sid}:${token}`)
        : Buffer.from(`${sid}:${token}`).toString('base64');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const error = `Twilio HTTP ${res.status} ${detail.slice(0, 300)}`.trim();
      console.warn(`[whatsapp:owner] send failed — ${error}`);
      return { sent: false, configured: true, error };
    }

    return { sent: true, configured: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[whatsapp:owner] send threw — ${error}`);
    return { sent: false, configured: true, error };
  }
}
