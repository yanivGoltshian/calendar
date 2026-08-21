/**
 * זיהוי סביבת ההתקנה של אפליקציית ה-PWA מתוך מחרוזת ה-User-Agent בלבד,
 * כדי שאפשר יהיה לבדוק אותה ביחידה בלי גישה ל-window.
 *
 * הפונקציה מבחינה בין שלוש פלטפורמות (iOS, אנדרואיד, מחשב) ובין ארבעה
 * סוגי דפדפן, כולל דפדפן מובנה בתוך אפליקציה (WhatsApp, אינסטגרם, פייסבוק
 * ועוד). בדפדפן מובנה אי אפשר להוסיף למסך הבית, ולכן יש לפתוח קודם בדפדפן
 * אמיתי (ספארי ב-iOS או כרום באנדרואיד).
 */

export type InstallPlatform = 'ios' | 'android' | 'desktop';
export type InstallBrowser = 'safari' | 'chrome' | 'inApp' | 'other';

export type InstallEnv = {
  platform: InstallPlatform;
  browser: InstallBrowser;
  /** אנדרואיד/כרום ומחשב: זמין אירוע beforeinstallprompt להתקנה בהקשה אחת. */
  canPromptInstall: boolean;
  /** iOS Safari: אפשר להוסיף ידנית למסך הבית דרך תפריט השיתוף. */
  canAddToHomeScreen: boolean;
  /** דפדפן מובנה באפליקציה: חובה לפתוח קודם בדפדפן אמיתי. */
  mustOpenInBrowser: boolean;
};

export type DetectInstallEnvOptions = {
  /** האם האפליקציה כבר פועלת במצב standalone (מותקנת). */
  standalone?: boolean;
  /** navigator.maxTouchPoints, לזיהוי best effort של iPadOS שמדווח כ-Mac. */
  maxTouchPoints?: number;
};

/** סימנים לדפדפנים מובנים נפוצים בתוך אפליקציות. הכול באותיות קטנות. */
const IN_APP_TOKENS = [
  'whatsapp',
  'wawebview',
  'instagram',
  'fban',
  'fbav',
  'fb_iab',
  'fbios',
  'messenger',
  'line/',
  'telegram',
  'tiktok',
  'musical_ly',
  'bytedance',
];

export function detectInstallEnv(
  userAgent: string,
  opts: DetectInstallEnvOptions = {},
): InstallEnv {
  const ua = (userAgent || '').toLowerCase();
  const touch = opts.maxTouchPoints ?? 0;
  const standalone = opts.standalone === true;

  const isAppleMobile = /iphone|ipad|ipod/.test(ua);
  // iPadOS 13+ בספארי מדווח כ-"Macintosh"; מזהים אותו לפי מגע כ-best effort.
  const isIPadAsMac = ua.includes('macintosh') && touch > 1;
  const isIOS = isAppleMobile || isIPadAsMac;
  const isAndroid = ua.includes('android');

  const platform: InstallPlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const isInApp =
    IN_APP_TOKENS.some((token) => ua.includes(token)) ||
    // WebView כללי באנדרואיד (בסיס לרוב הדפדפנים המובנים) מסומן ב-"; wv".
    (isAndroid && ua.includes(' wv'));

  const browser = detectBrowser({ ua, isInApp, isIOS, isAndroid });

  const canPromptInstall =
    !standalone && browser === 'chrome' && (platform === 'android' || platform === 'desktop');
  const canAddToHomeScreen = !standalone && platform === 'ios' && browser === 'safari';
  const mustOpenInBrowser = !standalone && browser === 'inApp';

  return { platform, browser, canPromptInstall, canAddToHomeScreen, mustOpenInBrowser };
}

/**
 * ההנחיה הידנית שיש להציג כשאין התקנה בהקשה אחת (או כגיבוי אם האירוע לא נורה).
 * זהו רכיב טהור הנגזר מ-InstallEnv בלבד, כדי שאפשר יהיה לבדוק אותו ביחידה:
 * - inApp: דפדפן מובנה — יש לפתוח קודם בדפדפן אמיתי.
 * - ios: iOS Safari — הוספה למסך הבית דרך תפריט השיתוף.
 * - iosOtherBrowser: iOS שאינו Safari (כרום/פיירפוקס) — יש לפתוח בספארי.
 * - android: הנחיית תפריט כרום/דפדפן באנדרואיד.
 * - desktop: סמל ההתקנה בשורת הכתובת בכרום/אדג׳ במחשב.
 * - manual: דפדפן מחשב ללא תמיכה בהתקנה (ספארי/פיירפוקס) — גיבוי כללי.
 */
export type InstallGuide =
  | 'ios'
  | 'iosOtherBrowser'
  | 'android'
  | 'desktop'
  | 'inApp'
  | 'manual';

export function installGuideFor(env: InstallEnv): InstallGuide {
  if (env.mustOpenInBrowser) return 'inApp';
  if (env.platform === 'ios') return env.canAddToHomeScreen ? 'ios' : 'iosOtherBrowser';
  if (env.platform === 'android') return 'android';
  if (env.platform === 'desktop') return env.canPromptInstall ? 'desktop' : 'manual';
  return 'manual';
}

function detectBrowser(input: {
  ua: string;
  isInApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}): InstallBrowser {
  const { ua, isInApp, isIOS, isAndroid } = input;

  if (isInApp) return 'inApp';

  if (isIOS) {
    if (ua.includes('crios')) return 'chrome';
    if (ua.includes('fxios') || ua.includes('edgios') || ua.includes('opios')) return 'other';
    if (ua.includes('safari')) return 'safari';
    return 'other';
  }

  if (isAndroid) {
    const chromium = ua.includes('chrome/') || ua.includes('crios');
    const branded =
      ua.includes('edg') ||
      ua.includes('opr') ||
      ua.includes('samsungbrowser') ||
      ua.includes('ucbrowser');
    return chromium && !branded ? 'chrome' : 'other';
  }

  // מחשב שולחני.
  if ((ua.includes('chrome/') || ua.includes('edg/')) && !ua.includes('opr')) return 'chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  return 'other';
}
