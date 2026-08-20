import { CONTACT } from '@/config/contact';
import { t } from '@/i18n';

/**
 * עוזרים טהורים לבניית קישור "לחיצה לצ׳אט" בוואטסאפ עבור בקשת הצעת מחיר.
 *
 * המסירה כולה בצד הלקוח: פותחים wa.me עם טקסט ליד מקודד, בלי שום תשתית שרת
 * (אין Twilio ואין SMTP בפרודקשן). המספר נגזר ממקור אמת יחיד — CONTACT.PHONE_E164.
 */

export type QuoteLeadInput = {
  /** שם העסק אם ידוע (בעל עסק מחובר). מושמט עבור מבקר ללא עסק. */
  businessName?: string | null;
  /** תווית החבילה המבוקשת בעברית (למשל "חבילת פרימיום"). */
  planLabel: string;
  /** שם איש הקשר / הבעלים. */
  ownerName: string;
  /** טלפון ליצירת קשר. */
  phone: string;
  /** אימייל ליצירת קשר. */
  email: string;
  /** כתובת עמוד העסק הציבורי אם קיימת. */
  publicPageUrl?: string | null;
};

/** משאיר ספרות בלבד ממספר E.164, כך ש-"+972524734788" הופך ל-"972524734788". */
export function normalizeWaPhone(e164: string): string {
  return e164.replace(/\D/g, '');
}

/** בונה קישור wa.me גולמי ממספר E.164 ומטקסט חופשי (הטקסט מקודד ל-URL). */
export function buildWhatsappLink(e164: string, message: string): string {
  const phone = normalizeWaPhone(e164);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** מרכיב את גוף הודעת הליד בעברית מתוך הפרטים שנאספו (טהור, ניתן לבדיקה). */
export function buildQuoteMessage(input: QuoteLeadInput): string {
  const w = t.quote.whatsapp;
  const lines: string[] = [w.intro, ''];

  const name = input.businessName?.trim();
  if (name) lines.push(`${w.labels.business}: ${name}`);

  lines.push(`${w.labels.plan}: ${input.planLabel}`);
  lines.push(`${w.labels.name}: ${input.ownerName}`);
  lines.push(`${w.labels.phone}: ${input.phone}`);
  lines.push(`${w.labels.email}: ${input.email}`);

  const page = input.publicPageUrl?.trim();
  if (page) lines.push(`${w.labels.page}: ${page}`);

  return lines.join('\n');
}

/**
 * הקישור המלא לשליחת הליד בוואטסאפ אל מספר הפלטפורמה.
 * ברירת המחדל למספר היא CONTACT.PHONE_E164, אך ניתן לדריסה לצורכי בדיקה.
 */
export function buildWhatsappQuoteLink(
  input: QuoteLeadInput,
  e164: string = CONTACT.PHONE_E164,
): string {
  return buildWhatsappLink(e164, buildQuoteMessage(input));
}
