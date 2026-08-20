/**
 * עוזרי טעינת נכסים משותפים לתמונות OG/אייקון דינמיות (next/og).
 * טעינות רשת (fetch) — לא טהורות ולכן אינן נבדקות ביחידה — ומשמשות
 * הן את האייקון הריבועי (icon/route.tsx) והן את כרטיס השיתוף (opengraph-image.tsx).
 */

/**
 * User-Agent ישן במכוון: Google Fonts מגיש TTF (במקום WOFF2) ל-UA ישנים,
 * ו-satori (next/og) יודע לפרש רק TTF/OTF.
 */
export const OG_FONT_UA =
  'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36';

/** טוען גופן עברי (Assistant TTF) מ-Google Fonts; מחזיר null בכשל. */
export async function loadHebrewFont(weight: number = 700): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Assistant:wght@${weight}`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': OG_FONT_UA } }).then((r) => r.text());
    const match = css.match(/src:\s*url\(([^)]+\.ttf)\)/);
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
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/png';
    if (!type.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}
