/**
 * לוגיקת ערוצי קמפיין ופתרון קהל היעד לנמענים בפועל.
 *
 * מודול טהור, חף מ-DB ומספקים, כדי שיהיה ניתן לבדיקה בקלות: הוא מקבל רשומות
 * לקוח (id/name/phone/email) ורשימת ערוצים, ומחזיר הודעה אחת לכל צירוף
 * לקוח×ערוץ-שמיש. ערוץ מייל דורש כתובת מייל; ערוצי sms/וואטסאפ דורשים טלפון.
 */

/** ערוצי המסירה הנתמכים בקמפיין. */
export type CampaignChannel = 'email' | 'sms' | 'whatsapp';

/** כל הערוצים בסדר תצוגה יציב (מייל, SMS, וואטסאפ). */
export const ALL_CAMPAIGN_CHANNELS: readonly CampaignChannel[] = ['email', 'sms', 'whatsapp'];

const CHANNEL_SET = new Set<string>(ALL_CAMPAIGN_CHANNELS);

/** בדיקת טיפוס: האם הערך הוא ערוץ קמפיין תקין. */
export function isCampaignChannel(value: unknown): value is CampaignChannel {
  return typeof value === 'string' && CHANNEL_SET.has(value);
}

/**
 * נרמול רשימת ערוצים גולמית (עם 'all', כפילויות או רישיות שונה) לרשימה קנונית
 * בסדר יציב. ערכים לא מוכרים מושמטים. 'all' מתרחב לכל הערוצים.
 */
export function normalizeChannels(raw: readonly string[] | null | undefined): CampaignChannel[] {
  if (!raw || raw.length === 0) return [];
  const set = new Set<CampaignChannel>();
  for (const item of raw) {
    const value = String(item).trim().toLowerCase();
    if (value === 'all') {
      for (const channel of ALL_CAMPAIGN_CHANNELS) set.add(channel);
    } else if (isCampaignChannel(value)) {
      set.add(value);
    }
  }
  return ALL_CAMPAIGN_CHANNELS.filter((channel) => set.has(channel));
}

/**
 * ערוצי קמפיין שמורים, עם נפילה לאחור. קמפיינים היסטוריים (שנוצרו לפני שהוסף
 * שדה channels) שמורים עם רשימה ריקה — עבורם מוחזר הערוץ ההיסטורי sms (שנמסר
 * דרך וואטסאפ ברמת הספק), כדי לשמר את ההתנהגות הקודמת.
 */
export function parseCampaignChannels(
  raw: readonly string[] | null | undefined,
): CampaignChannel[] {
  const normalized = normalizeChannels(raw);
  return normalized.length > 0 ? normalized : ['sms'];
}

/**
 * סינון ערוצי הקמפיין לפי דרגת החבילה, נקודת האכיפה של המודל המדורג בקמפיינים.
 * וואטסאפ מוסתר תמיד באיטרציה זו (תשתית עתידית רדומה בלבד). ערוץ SMS בתשלום
 * מותר רק בעסקי אקסלוסיב; בפרימיום ובבסיס נותר מייל בלבד. מייל מותר תמיד.
 * טהור וניתן לבדיקה — מיושם גם בשרת (sendCampaign) וגם בטופס (הצגת הערוצים).
 */
export function allowedCampaignChannels(
  raw: readonly string[] | null | undefined,
  opts: { isExclusive: boolean },
): CampaignChannel[] {
  return parseCampaignChannels(raw).filter((channel) => {
    if (channel === 'whatsapp') return false;
    if (channel === 'sms') return opts.isExclusive;
    return true;
  });
}

/** רשומת לקוח מינימלית לפתרון קהל היעד. */
export interface AudienceClient {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** הודעה בודדת לנמען: לקוח, ערוץ וכתובת יעד (טלפון או מייל). */
export interface CampaignRecipientMessage {
  clientId: string;
  channel: CampaignChannel;
  address: string;
}

/** תוצאת פתרון קהל: רשימת ההודעות + מספר הנמענים הייחודיים שאליהם ניתן להגיע. */
export interface ResolvedCampaignRecipients {
  messages: CampaignRecipientMessage[];
  /** מספר הלקוחות הייחודיים עם ערוץ שמיש אחד לפחות. */
  recipientCount: number;
}

/** האם לערוץ נתון הכתובת היא מייל (אחרת — טלפון). */
function addressForChannel(client: AudienceClient, channel: CampaignChannel): string | null {
  if (channel === 'email') return client.email?.trim() || null;
  // sms + whatsapp — שניהם משתמשים בטלפון.
  return client.phone?.trim() || null;
}

/**
 * פתרון קהל היעד לרשימת הודעות בפועל: הודעה אחת לכל צירוף לקוח×ערוץ-שמיש.
 * ערוצים מנורמלים תחילה; רשימה ריקה נופלת לערוץ ההיסטורי (sms).
 */
export function resolveCampaignRecipients(
  clients: readonly AudienceClient[],
  channels: readonly string[],
): ResolvedCampaignRecipients {
  const effective = parseCampaignChannels(channels);
  const messages: CampaignRecipientMessage[] = [];
  const reachedClients = new Set<string>();

  for (const client of clients) {
    for (const channel of effective) {
      const address = addressForChannel(client, channel);
      if (address) {
        messages.push({ clientId: client.id, channel, address });
        reachedClients.add(client.id);
      }
    }
  }

  return { messages, recipientCount: reachedClients.size };
}
