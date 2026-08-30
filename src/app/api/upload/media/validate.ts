// ולידציה טהורה (ללא תלות שרת) לסוג/גודל של קובץ מדיה בהעלאה.
// משותפת למסלול ההעלאה ולמבחנים, כדי לנעול את החלטות ההסתעפות במקום אחד.

// מגבלות גודל: 8MB לתמונות, 30MB לסרטונים.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

// סוגי MIME מותרים → סיומת + קטגוריה, לבחירת מגבלת הגודל ולשם ה-blob.
export const ALLOWED_MEDIA: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  // אייפון מצלם בפורמט QuickTime (‎.mov‎) — מותר כדי לא לחסום משתמשי iOS.
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/x-m4v': { ext: 'm4v', kind: 'video' },
};

export type MediaKind = 'image' | 'video';

export type MediaValidationResult =
  | { ok: true; ext: string; kind: MediaKind }
  | { ok: false; status: number; error: string };

/**
 * מאמת קובץ מדיה לפי סוג ה-MIME והגודל בלבד (ניתן לבדיקה ללא File או רשת).
 * תמונות: jpg, png, webp עד 8MB. סרטונים: mp4, webm, mov עד 30MB.
 * מחזיר תוצאה בעברית עם סטטוס HTTP מתאים לכל סוג כשל.
 */
export function validateMediaFile(input: {
  type: string;
  size: number;
}): MediaValidationResult {
  const meta = ALLOWED_MEDIA[input.type];
  if (!meta) {
    return {
      ok: false,
      status: 415,
      error: 'אפשר להעלות תמונה בפורמט jpg, png או webp, או סרטון בפורמט mp4, webm או mov.',
    };
  }
  const max = meta.kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (input.size > max) {
    return {
      ok: false,
      status: 413,
      error:
        meta.kind === 'image'
          ? 'התמונה גדולה מדי. אפשר עד 8MB.'
          : 'הסרטון גדול מדי. אפשר עד 30MB.',
    };
  }
  return { ok: true, ext: meta.ext, kind: meta.kind };
}
