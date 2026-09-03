/**
 * לוגיקה טהורה של מילוי מראש בטופס ההזמנה (בר-בדיקה, ללא תלות ב-DOM/רשת).
 *
 * הרקע: השלד של דף ההזמנה נשמר כ-ISR ללא PII, ולכן פרטי הלקוח המחובר נטענים
 * בצד הלקוח דרך /api/public/customer-session ורק אז ממלאים את השדות. הפונקציות
 * כאן מרכזות את המיפוי של תשובת ה-API ואת נגזרת תצוגת שדה המייל, כדי שאפשר יהיה
 * לבדוק אותן ישירות והרכיב (BookingStepper) רק יצרוך אותן.
 */

export type PublicCustomer = { name: string; phone: string; email: string };

/**
 * ממפה את תשובת /api/public/customer-session לפרטי לקוח מנורמלים, או null לאורח.
 * שדות חסרים מומרים למחרוזת ריקה כדי לשמור על אותה התנהגות מילוי מראש כמו קודם.
 */
export function parseCustomerSession(json: unknown): PublicCustomer | null {
  if (!json || typeof json !== 'object') return null;
  const customer = (json as { customer?: unknown }).customer;
  if (!customer || typeof customer !== 'object') return null;
  const rec = customer as Record<string, unknown>;
  return {
    name: typeof rec.name === 'string' ? rec.name : '',
    phone: typeof rec.phone === 'string' ? rec.phone : '',
    email: typeof rec.email === 'string' ? rec.email : '',
  };
}

export type EmailFieldVisibility = {
  requireEmail: boolean;
  hideEmailField: boolean;
  showEmailField: boolean;
};

/**
 * נגזרת תצוגת שדה המייל בטופס ההזמנה:
 * - requireEmail: מייל נדרש רק בפרימיום/אקסקלוסיב (אישור, תזכורות והרשמת לקוח).
 * - hideEmailField: לקוח מחובר עם מייל קיים אינו צריך להקליד מייל.
 * - showEmailField: מוצג רק כאשר נדרש וגם אינו מוסתר.
 */
export function computeEmailFieldVisibility(
  plan: string,
  customer: PublicCustomer | null,
): EmailFieldVisibility {
  const requireEmail = plan === 'premium' || plan === 'exclusive';
  const authedEmail = customer?.email?.trim() ?? '';
  const hideEmailField = !!customer && authedEmail.length > 0;
  const showEmailField = requireEmail && !hideEmailField;
  return { requireEmail, hideEmailField, showEmailField };
}
