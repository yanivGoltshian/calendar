/**
 * שכבת מסירת קמפיינים: קביעת מצב המסירה (חי/פיתוח) לפי משתני סביבה, וניתוב הודעה
 * בודדת לספק הנכון (מייל / SMS / וואטסאפ).
 *
 * getCampaignDeliveryStatus טהורה וניתנת להזרקת env — היא משכפלת את לוגיקת בחירת
 * הספק של messaging.ts ואת תצורת המייל של email.ts, מבלי לגעת ב-DB או ברשת, כדי
 * שתהיה ניתנת לבדיקה. deliverCampaignMessage מנתבת לפי ערוץ, עם הזרקת תלויות
 * (deps) לבדיקות, וברירת מחדל לפונקציות הספק האמיתיות.
 */

import { BRAND } from '@/config/brand';
import { sendEmail } from '@/server/providers/email';
import { sendSms, sendWhatsApp } from '@/server/providers/messaging';
import type { CampaignChannel } from './channels';

/** מפת סטטוס המסירה החי לכל ערוץ, וסימון האם ערוץ חי כלשהו מוגדר. */
export interface CampaignDeliveryStatus {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** האם קיים ערוץ חי אחד לפחות (אחרת — מצב פיתוח, הצגת באנר הפיתוח). */
  anyLive: boolean;
}

type DeliveryEnv = Record<string, string | undefined>;

/**
 * האם ספק ההודעות (SMS/וואטסאפ) מוגדר כחי. משכפל את בחירת הספק של
 * resolveMessagingProvider: הבחירה נלקחת מ-MESSAGING_PROVIDER ואז SMS_PROVIDER,
 * וברירת המחדל 'console'. כל ערך שאינו ריק ואינו 'console' נחשב ספק חי.
 */
function messagingConfigured(env: DeliveryEnv): boolean {
  const selected = (env.MESSAGING_PROVIDER ?? env.SMS_PROVIDER ?? 'console').trim().toLowerCase();
  return selected !== '' && selected !== 'console';
}

/** האם המייל מוגדר כחי. משכפל את emailConfigured של email.ts (EMAIL_SERVER + EMAIL_FROM). */
function emailConfiguredFor(env: DeliveryEnv): boolean {
  return Boolean((env.EMAIL_SERVER ?? '').trim() && (env.EMAIL_FROM ?? '').trim());
}

/**
 * מצב מסירת הקמפיינים לפי הסביבה. ספק ההודעות החי (whatsapp-cloud) מוסר גם וואטסאפ
 * וגם SMS, ולכן שני הערוצים משתקפים ממנו. הפרמטר env ניתן להזרקה לצורך בדיקות.
 */
export function getCampaignDeliveryStatus(env: DeliveryEnv = process.env): CampaignDeliveryStatus {
  const messaging = messagingConfigured(env);
  const email = emailConfiguredFor(env);
  return {
    email,
    sms: messaging,
    whatsapp: messaging,
    anyLive: email || messaging,
  };
}

/** תלויות שליחה — ניתנות להזרקה בבדיקות; ברירת המחדל היא ספקי האמת. */
export interface CampaignDeliveryDeps {
  sendEmail: (to: string, subject: string, text: string, html?: string) => Promise<void>;
  sendSms: (to: string, message: string) => Promise<void>;
  sendWhatsApp: (to: string, message: string) => Promise<void>;
}

const defaultDeliveryDeps: CampaignDeliveryDeps = { sendEmail, sendSms, sendWhatsApp };

/**
 * מסירת הודעת קמפיין בודדת בערוץ נתון לכתובת נתונה. מנתבת לספק המתאים.
 * זריקה מהספק (למשל כשל SMTP או API של וואטסאפ) מתפשטת לקורא, שמסמן כשל לנמען.
 */
export async function deliverCampaignMessage(
  channel: CampaignChannel,
  address: string,
  body: string,
  options: { subject?: string; deps?: CampaignDeliveryDeps } = {},
): Promise<void> {
  const deps = options.deps ?? defaultDeliveryDeps;
  const subject = options.subject ?? BRAND.name;
  switch (channel) {
    case 'email':
      await deps.sendEmail(address, subject, body);
      return;
    case 'sms':
      await deps.sendSms(address, body);
      return;
    case 'whatsapp':
      await deps.sendWhatsApp(address, body);
      return;
  }
}
