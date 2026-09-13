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

function relativeLuminance(hex: string): number {
  const channels = toRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** בוחר טקסט בהיר או כהה שעומד בניגוד WCAG AA מול צבע הרקע כשאפשר. */
export function readableText(hex: string): string {
  const background = expand(hex);
  const dark = '#0A182D';
  const light = '#ffffff';
  const darkContrast = contrastRatio(dark, background);
  const lightContrast = contrastRatio(light, background);
  if (darkContrast >= 4.5 && darkContrast >= lightContrast) return dark;
  if (lightContrast >= 4.5) return light;
  return '#000000';
}
