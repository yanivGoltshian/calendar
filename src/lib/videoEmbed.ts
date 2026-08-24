/**
 * פתרון סרטון לראש העמוד: קישור יוטיוב/וימאו הופך ל-embed, כתובת קובץ ישירה נשארת file.
 * מאפשר לבעלי עסק להדביק קישור יוטיוב או וימאו במקום כתובת mp4 בלבד.
 */
export type HeroVideo =
  | { kind: 'file'; src: string }
  | { kind: 'embed'; src: string };

// מזהה יוטיוב תמיד באורך 11 תווים; תומך ב-youtu.be, watch?v=, shorts, embed, live.
const YOUTUBE_ID =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/;
// מזהה וימאו הוא רצף ספרות; תומך ב-vimeo.com/<id> וב-player.vimeo.com/video/<id>.
const VIMEO_ID = /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/;

export function heroVideoResolve(url: string | null | undefined): HeroVideo | null {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;

  const yt = trimmed.match(YOUTUBE_ID);
  if (yt) {
    const id = yt[1];
    return {
      kind: 'embed',
      src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&modestbranding=1&rel=0&playlist=${id}`,
    };
  }

  const vm = trimmed.match(VIMEO_ID);
  if (vm) {
    const id = vm[1];
    return {
      kind: 'embed',
      src: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`,
    };
  }

  // כתובת קובץ ישירה: אותו שער כמו publicPageStyle (http(s):// או נתיב מוחלט).
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return { kind: 'file', src: trimmed };
  }

  return null;
}
