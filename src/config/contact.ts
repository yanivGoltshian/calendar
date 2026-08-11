/**
 * פרטי קשר של הפלטפורמה לפניות שדרוג ומכירות (מקור אמת יחיד).
 *
 * משמש בבלוק "שדרוג ופנייה עסקית" בעמוד הנחיתה ובמסך ה-paywall של הבעלים.
 * ניתן לדרוס דרך משתני סביבה (PLATFORM_CONTACT_PHONE / PLATFORM_CONTACT_EMAIL),
 * אחרת נעשה שימוש בברירות המחדל שלמטה.
 */
export const CONTACT = {
  /** מספר טלפון לתצוגה (עברית/מקומי) */
  PHONE_DISPLAY: '052-473-4788',
  /** מספר טלפון בפורמט E.164 עבור קישור tel: */
  PHONE_E164: '+972524734788',
  /** כתובת דוא״ל לפניות עסקיות */
  EMAIL: 'yanivgolt@gmail.com',
} as const;

/** מספר הטלפון לתצוגה (עם דריסה אופציונלית מסביבה). */
export function contactPhoneDisplay(): string {
  return process.env.PLATFORM_CONTACT_PHONE?.trim() || CONTACT.PHONE_DISPLAY;
}

/** מספר הטלפון בפורמט E.164 עבור קישור tel:. */
export function contactPhoneE164(): string {
  const raw = process.env.PLATFORM_CONTACT_PHONE?.trim();
  if (raw && raw.startsWith('+')) return raw;
  return CONTACT.PHONE_E164;
}

/** כתובת הדוא״ל לפניות (עם דריסה אופציונלית מסביבה). */
export function contactEmail(): string {
  return process.env.PLATFORM_CONTACT_EMAIL?.trim() || CONTACT.EMAIL;
}

export type ContactInfo = {
  phoneDisplay: string;
  phoneE164: string;
  email: string;
};

/** אוסף מרוכז של פרטי הקשר לצריכה ברכיבים. */
export function getContactInfo(): ContactInfo {
  return {
    phoneDisplay: contactPhoneDisplay(),
    phoneE164: contactPhoneE164(),
    email: contactEmail(),
  };
}
