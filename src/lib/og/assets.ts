/**
 * עוזרי טעינת נכסים משותפים לתמונות OG/אייקון דינמיות (next/og).
 * טעינות רשת (fetch) — לא טהורות ולכן אינן נבדקות ביחידה — ומשמשות
 * הן את האייקון הריבועי (icon/route.tsx) והן את כרטיס השיתוף (opengraph-image.tsx).
 */

import { readSafeImage } from '@/server/media/safeFetch';
import { decodeLegacyImage } from '@/server/media/publicContent';
import { optimizeImage } from '@/server/media/image';

/**
 * User-Agent ישן במכוון: Google Fonts מגיש TTF (במקום WOFF/WOFF2) ל-UA ישנים,
 * ו-satori (next/og) יודע לפרש רק TTF/OTF. חשוב: ה-UA של Chrome/40 שהיה כאן קודם
 * חזר להגיש WOFF (ולא TTF) => הביטוי הרגולרי ל-.ttf נכשל, loadHebrewFont החזיר
 * null, ו-satori נשאר בלי גופן עברי. UA של Android 2.3 עדיין מקבל truetype.
 */
export const OG_FONT_UA =
  'Mozilla/5.0 (Linux; U; Android 2.3; en-us) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

/** טוען גופן עברי (Assistant TTF) מ-Google Fonts; מחזיר null בכשל. */
export async function loadHebrewFont(weight: number = 700): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Assistant:wght@${weight}`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': OG_FONT_UA } }).then((r) => r.text());
    // מחפשים כתובת גופן שהיא TTF: או שהסיומת .ttf, או format('truetype') מפורש.
    const match =
      css.match(/src:\s*url\(([^)]+\.ttf)\)/) ??
      css.match(/url\(([^)]+)\)\s*format\(['"]truetype['"]\)/);
    if (!match) return null;
    return await fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** מנסה לטעון לוגו חיצוני כ-data URI (מאמת image/*); מחזיר null בכשל. */
export async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const input = url.startsWith('data:') ? decodeLegacyImage(url) : await readSafeImage(url);
    if (!input) return null;
    const image = await optimizeImage(input, 960);
    return `data:image/webp;base64,${image.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * כינוי סמנטי דק ל-loadLogo לטעינת תמונת העסק (cover) לכרטיס השיתוף —
 * אותה לוגיקה בדיוק (מאמת image/*, מחזיר null בכשל), רק שם קריא יותר בהקשר.
 */
export const loadImage = loadLogo;
