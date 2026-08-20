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

/** מפרק hex תקין לשלושה ערוצי צבע (0–255). קלט לא תקין נופל לשחור. */
export function toRgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex) ?? '#000000';
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function channelToHex(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0');
}

/** מרכיב צבע hex משלושה ערוצי RGB (עם קיטום לתחום 0–255). */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

/** מערבב שני צבעים לפי משקל 0–1 (0 = הצבע הראשון, 1 = הצבע השני). */
export function mix(from: string, to: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const [r1, g1, b1] = toRgb(from);
  const [r2, g2, b2] = toRgb(to);
  return rgbToHex(r1 + (r2 - r1) * w, g1 + (g2 - g1) * w, b1 + (b2 - b1) * w);
}

/** מבהיר צבע על ידי ערבוב עם לבן (amount 0–1). שימושי לגוונים בהירים. */
export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount);
}

/** מכהה צבע על ידי ערבוב עם שחור (amount 0–1). שימושי לגוונים כהים. */
export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

/** מחזיר rgba() עם שקיפות (alpha 0–1) — שימושי לרקעים רכים ולמסגרות. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}
