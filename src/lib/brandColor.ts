import { BRAND } from '@/config/brand';

/**
 * עוזרי צבע מותג ל-PWA לכל עסק.
 * מנרמלים קלט חופשי לצבע hex תקין, עם נפילה חלקה לצבע תור צ׳יק,
 * ומחשבים צבע טקסט קריא (לבן או כהה) מעל צבע הרקע.
 */

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** מרחיב hex מקוצר (#abc) ל-#aabbcc. */
function expand(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/** מחזיר צבע מותג תקין (hex) או נפילה לצבע המותג של תור צ׳יק. */
export function resolveBrandColor(input?: string | null): string {
  const value = (input ?? '').trim();
  if (HEX_RE.test(value)) return expand(value).toLowerCase();
  return BRAND.themeColor;
}

/** צבע הרקע לכרטיס/מסך פתיחה — כרגע קבוע לצבע הרקע של המותג. */
export function resolveBackgroundColor(): string {
  return BRAND.backgroundColor;
}

/** מפרק hex לשלושה ערוצי צבע (0–255). */
function toRgb(hex: string): [number, number, number] {
  const full = expand(hex);
  return [
    parseInt(full.slice(1, 3), 16),
    parseInt(full.slice(3, 5), 16),
    parseInt(full.slice(5, 7), 16),
  ];
}

/** בוחר טקסט קריא (לבן או נייבי כהה) לפי בהירות הרקע. */
export function readableText(hex: string): string {
  const [r, g, b] = toRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0A182D' : '#ffffff';
}
