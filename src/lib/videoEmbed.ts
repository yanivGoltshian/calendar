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

/**
 * פתרון סרטון חברתי להטמעה רשמית בעמוד הציבורי — מבחין בין הפלטפורמות
 * כדי שהרנדרר יבחר את ההטמעה הנכונה: יוטיוב (iframe פרטיות), וימאו (iframe נגן),
 * וטיקטוק (blockquote רשמי + embed.js). שונה מ-heroVideoResolve שמשמש את ראש העמוד.
 */
export type SocialVideo =
  | { platform: 'youtube'; src: string }
  | { platform: 'vimeo'; src: string }
  | { platform: 'tiktok'; cite: string; videoId: string | null };

// מזהה סרטון טיקטוק מלא: tiktok.com/@user/video/<ספרות>.
const TIKTOK_VIDEO_ID = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
// קישור טיקטוק מקוצר: vm.tiktok.com/xxx או vt.tiktok.com/xxx (ללא מזהה מספרי).
const TIKTOK_SHORT = /(?:vm|vt)\.tiktok\.com\/[\w.-]+/i;

export function socialVideoResolve(url: string | null | undefined): SocialVideo | null {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;

  const yt = trimmed.match(YOUTUBE_ID);
  if (yt) {
    const id = yt[1];
    // iframe פרטיות (youtube-nocookie) עם נגן נקי; ללא autoplay כי זו גלריית סרטונים.
    return {
      platform: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
    };
  }

  const tiktokFull = trimmed.match(TIKTOK_VIDEO_ID);
  if (tiktokFull) {
    return { platform: 'tiktok', cite: trimmed, videoId: tiktokFull[1] };
  }
  if (TIKTOK_SHORT.test(trimmed)) {
    return { platform: 'tiktok', cite: trimmed, videoId: null };
  }

  const vm = trimmed.match(VIMEO_ID);
  if (vm) {
    return { platform: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}` };
  }

  return null;
}
