/**
 * עוזרי צבע hex לטופס המיתוג — אימות ונרמול של קלט צבע חופשי.
 * משלים את src/lib/brandColor.ts (שאחראי על נפילה חלקה לצבע המותג בזמן הצגה).
 */

/** ביטוי רגולרי לצבע hex תקין: ‎#rgb או ‎#rrggbb. */
export const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** האם המחרוזת היא צבע hex תקין (עם ‎#, שלוש או שש ספרות). */
export function isValidHex(input: string): boolean {
  return HEX_COLOR_RE.test(input.trim());
}

/** מרחיב hex מקוצר (‎#abc) ל-‎#aabbcc. */
function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/**
 * מנרמל קלט צבע חופשי לצורת ‎#rrggbb באותיות קטנות.
 * מוסיף ‎# חסר ומרחיב צורה מקוצרת. מחזיר null כשאין צבע תקין,
 * כדי שהקורא יוכל לשמור על ערך ריק (נפילה לצבע המותג).
 */
export function normalizeHex(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!value.startsWith('#')) value = `#${value}`;
  if (!HEX_COLOR_RE.test(value)) return null;
  return expandHex(value);
}

/**
 * ערך לבורר הצבע המובנה (input type="color"), שמחייב תמיד ‎#rrggbb.
 * מנרמל, ואם אין צבע תקין נופל לערך ברירת המחדל שהתקבל.
 */
export function toColorInputValue(input: string, fallback: string): string {
  return normalizeHex(input) ?? fallback;
}
