/**
 * עוזרי טעינת נכסים משותפים לתמונות OG/אייקון דינמיות (next/og).
 * טעינות רשת (fetch) — לא טהורות ולכן אינן נבדקות ביחידה — ומשמשות
 * הן את האייקון הריבועי (icon/route.tsx) והן את כרטיס השיתוף (opengraph-image.tsx).
 */

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MAX_RENDERED_IMAGE_BYTES } from '@/lib/media';
import { cachedImage } from '@/server/media/cache';
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

async function loadPng(url: string | null, maximum: number): Promise<string | null> {
  if (!url) return null;
  try {
    const input = url.startsWith('data:') ? decodeLegacyImage(url) : await readSafeImage(url);
    if (!input) return null;
    const image = await optimizeImage(input, maximum);
    // Next's OG decoder needs PNG data URIs. Convert only the already bounded
    // WebP, sharing the render cache's concurrency and memory limits.
    const key = `og-png:${maximum}:${createHash('sha256').update(image).digest('hex')}`;
    const png = await cachedImage(key, async () => {
      for (const bound of [maximum, ...[640, 320, 160].filter((size) => size < maximum)]) {
        const output = await sharp(image, { limitInputPixels: 1600 * 1600, animated: false, sequentialRead: true })
          .resize({ width: bound, height: bound, fit: 'inside', withoutEnlargement: true })
          .timeout({ seconds: 5 }).png({ compressionLevel: 6 }).toBuffer();
        if (output.length <= MAX_RENDERED_IMAGE_BYTES) return output;
      }
      throw new Error('og_image_output_budget');
    });
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Loads a bounded PNG logo for OG cards and icons, returning null on failure. */
export function loadLogo(url: string | null): Promise<string | null> {
  return loadPng(url, 512);
}

/** Loads a bounded PNG cover for OG cards, returning null on failure. */
export function loadImage(url: string | null): Promise<string | null> {
  return loadPng(url, 1600);
}
