/**
 * קידוד data URL של תמונה אל מתחת לתקרת גודל, עם דחיסה מדורגת ל-JPEG.
 * טהור (ללא DOM): מקבל פונקציית encode שמחזירה data URL לאיכות נתונה,
 * כדי שאפשר לבדוק את ההיגיון ביחידה בלי קנבס אמיתי.
 */

/** תקרת גודל נוחה מתחת למגבלת גוף ה-Server Action, לכל תמונה בנפרד. */
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/** ברירת מחדל של איכות JPEG לפני דחיסה מדורגת. */
export const DEFAULT_JPEG_QUALITY = 0.85;

/** מדרגות איכות יורדות לניסיונות דחיסה נוספים ל-JPEG. */
export const JPEG_QUALITY_STEPS = [0.7, 0.6, 0.5];

/**
 * גודל משוער בבייטים של מטען ה-base64 ב-data URL, לפי אורך המחרוזת.
 * מתעלם מקידומת ה-`data:...;base64,`, מחשב לפי 4 תווי base64 = 3 בייטים,
 * ומפחית את ריפוד ה-`=` שבסוף.
 */
export function approxDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

export interface EncodeUnderLimitParams {
  /** מקודד את התמונה ל-data URL באיכות נתונה (undefined ⇐ ברירת המחדל של הפורמט). */
  encode: (quality?: number) => string;
  /** האם הפורמט נדחס באיכות (JPEG). PNG אינו נדחס ולכן מקודד פעם אחת. */
  compressible: boolean;
  /** תקרת גודל בבייטים. ברירת מחדל: IMAGE_MAX_BYTES. */
  maxBytes?: number;
  /** איכות התחלתית (רלוונטי כשcompressible). */
  quality?: number;
  /** מדרגות איכות נוספות לניסיון כשעדיין גדול מדי. */
  qualitySteps?: number[];
}

export interface EncodeUnderLimitResult {
  dataUrl: string;
  ok: boolean;
}

/**
 * מקודד data URL ומנסה להיכנס מתחת לתקרה. לפורמט נדחיס (JPEG) מנסה מדרגות
 * איכות יורדות עד שנכנס. מחזיר את ה-data URL הטוב ביותר שהתקבל ודגל ok
 * שמציין אם הוא בתוך התקרה.
 */
export function encodeUnderLimit(
  params: EncodeUnderLimitParams,
): EncodeUnderLimitResult {
  const maxBytes = params.maxBytes ?? IMAGE_MAX_BYTES;
  const quality = params.quality ?? DEFAULT_JPEG_QUALITY;
  const steps = params.qualitySteps ?? JPEG_QUALITY_STEPS;

  let dataUrl = params.compressible ? params.encode(quality) : params.encode();
  if (params.compressible) {
    for (const step of steps) {
      if (approxDataUrlBytes(dataUrl) <= maxBytes) break;
      dataUrl = params.encode(step);
    }
  }
  return { dataUrl, ok: approxDataUrlBytes(dataUrl) <= maxBytes };
}
