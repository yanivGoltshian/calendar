import { DEFAULT_BRAND } from './registry';

/**
 * מילוי מקדים של משתני-העסק בתבניות ההודעות, מנתוני האונבורדינג.
 *
 * מודול טהור ובטוח-ללקוח (אין כאן גישה ל-DB). הוא מבחין בין שני סוגי משתנים:
 * - משתני-עסק ({{businessName}}, {{businessPhone}}, {{businessAddress}}, {{brand}}) —
 *   ידועים כבר בזמן עריכת ההגדרות, ולכן ממולאים מראש כך שהבעלים אינו רואה סוגריים.
 * - משתני התור-הבודד ({{clientName}}, {{date}}, {{time}}, ...) — נותרים כפלייסהולדר
 *   כי הם מתמלאים אוטומטית לכל הודעה בזמן השליחה.
 *
 * אותה פונקציית מילוי משמשת גם לתצוגת ברירת-המחדל בעורך וגם להשוואת השמירה, כדי
 * ששמירה של תבנית מלאת-פרטים ללא עריכה לא תיצור דריסה מיותרת.
 */

/** הקשר ערכי-העסק להצבה בתבנית. שדות ריקים נשארים כפלייסהולדר במילוי-העורך. */
export interface BusinessTemplateContext {
  businessName: string;
  businessPhone?: string | null;
  businessAddress?: string | null;
  brand?: string | null;
}

/** שמות המשתנים ברמת-העסק — אלה שנפתרים כבר בשלב העריכה. */
export const BUSINESS_TOKEN_NAMES = [
  'businessName',
  'businessPhone',
  'businessAddress',
  'brand',
] as const;

/** ערכי-הדגמה למשתני התור-הבודד, לתצוגה מקדימה מלאה נטולת סוגריים. */
export const SAMPLE_CLIENT_VALUES: Record<string, string> = {
  clientName: 'ישראל ישראלי',
  services: 'תספורת',
  date: 'יום שלישי, 3 בספטמבר',
  time: '14:30',
  manageUrl: 'https://torchick.example/c/demo',
  code: '123456',
};

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * ערכי-עסק שיש להם ערך ממשי בלבד. {{brand}} תמיד מקבל ערך (ברירת-מחדל אם חסר),
 * ולכן לעולם אינו נשאר כפלייסהולדר בעורך.
 */
function presentBusinessValues(ctx: BusinessTemplateContext): Record<string, string> {
  const out: Record<string, string> = {};
  const name = trimmed(ctx.businessName);
  if (name) out.businessName = name;
  const phone = trimmed(ctx.businessPhone);
  if (phone) out.businessPhone = phone;
  const address = trimmed(ctx.businessAddress);
  if (address) out.businessAddress = address;
  out.brand = trimmed(ctx.brand) || DEFAULT_BRAND;
  return out;
}

/**
 * ממלא רק את משתני-העסק בתבנית, ומשאיר את משתני התור-הבודד כפי שהם. משתנה-עסק
 * ללא ערך נשאר גם הוא כפלייסהולדר, כדי לא ליצור שורה חסרת-ערך מבלבלת.
 */
export function fillBusinessTokens(
  template: string,
  ctx: BusinessTemplateContext,
): string {
  const values = presentBusinessValues(ctx);
  return template.replace(TOKEN_RE, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match,
  );
}

/** כל ערכי-העסק, כולל ריקים כמחרוזת ריקה, לצורך תצוגה מקדימה בלבד. */
function allBusinessValues(ctx: BusinessTemplateContext): Record<string, string> {
  return {
    businessName: trimmed(ctx.businessName),
    businessPhone: trimmed(ctx.businessPhone),
    businessAddress: trimmed(ctx.businessAddress),
    brand: trimmed(ctx.brand) || DEFAULT_BRAND,
  };
}

/**
 * תצוגה מקדימה מלאה: ממלאת גם ערכי-עסק אמיתיים וגם ערכי-הדגמה למשתני התור, וכל
 * משתנה שאינו מוכר מוחלף במחרוזת ריקה — כך שהתוצאה לעולם אינה מכילה סוגריים.
 * לתצוגה בלבד; אינה נשמרת ואינה נשלחת.
 */
export function previewTemplate(
  template: string,
  ctx: BusinessTemplateContext,
): string {
  const vars: Record<string, string> = {
    ...allBusinessValues(ctx),
    ...SAMPLE_CLIENT_VALUES,
  };
  return template.replace(TOKEN_RE, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : '',
  );
}
