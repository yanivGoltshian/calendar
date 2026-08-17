/**
 * לוגיקת origin קנוני (canonical). טהורה וניתנת לבדיקה, ללא תלות ב-next/server.
 *
 * למה זה קיים:
 * האפליקציה נגישה תחת שני origins שמצביעים לאותו Container App: הדומיין הממותג
 * (למשל https://torchick.duckdns.org) וה-FQDN המובנה של Azure. זרימת ה-OAuth של
 * Google מסתמכת על עוגיית PKCE (code_verifier) שנכתבת על ה-origin שבו ההתחברות
 * התחילה; אם ה-redirect_uri של Google מצביע ל-origin אחר, ה-callback נוחת במקום
 * שבו העוגייה חסרה, ו-Auth.js נכשל ב-InvalidCheck ומציג את עמוד שגיאת Configuration.
 *
 * הפתרון: לרכז את כל הניווטים ל-origin קנוני יחיד עוד לפני שההתחברות מתחילה, כך
 * שההתחברות מתחילה ומסתיימת על אותו origin. הפונקציות כאן מחזירות רק את ההחלטה
 * (יעד להפניה או null); ה-middleware הוא שמבצע את ההפניה בפועל.
 *
 * בטוח כברירת מחדל: אם אין origin קנוני מוגדר, אם ה-host כבר תואם, או אם מדובר
 * במארח פנימי / probe, לא מתבצעת הפניה (no-op).
 */

type EnvLike = Record<string, string | undefined>;

/** נירמול origin: פרוטוקול + host בלבד, בלי path או סלאש סופי. null אם לא תקין. */
function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.host) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * גוזר את ה-origin הקנוני מ-env לפי סדר עדיפות:
 *   APP_CANONICAL_URL (חדש, אדיטיבי) → AUTH_URL → NEXTAUTH_URL → NEXT_PUBLIC_APP_URL.
 * מחזיר origin מנורמל (למשל "https://torchick.duckdns.org") או null אם אין ערך תקין.
 */
export function getCanonicalOrigin(env: EnvLike = process.env): string | null {
  return (
    normalizeOrigin(env.APP_CANONICAL_URL) ??
    normalizeOrigin(env.AUTH_URL) ??
    normalizeOrigin(env.NEXTAUTH_URL) ??
    normalizeOrigin(env.NEXT_PUBLIC_APP_URL)
  );
}

/**
 * מארחים פנימיים / בדיקות בריאות (probes) שאסור להפנות מהם:
 * loopback, כתובת IP, או שם ללא נקודה (שם שירות פנימי). הפניה מהם עלולה לשבור
 * את ה-health probe של ACA או פיתוח מקומי.
 */
function isInternalHost(host: string): boolean {
  const hostname = (host.split(':')[0] ?? '').toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
  // כתובת IPv4 (probe / רשת פנימית), לא מפנים.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // שם ללא נקודה (שם שירות פנימי / probe), לא מפנים.
  if (!hostname.includes('.')) return true;
  return false;
}

export type CanonicalDecisionInput = {
  /** המתודה של הבקשה (רק GET/HEAD אידמפוטנטיים מופנים). */
  method: string;
  /** ה-host שהגיע בבקשה (כותרת Host / nextUrl.host). */
  host: string | null | undefined;
  /** ה-path של הבקשה (למשל "/business/login"). */
  pathname: string;
  /** ה-query כולל '?' מוביל אם קיים (למשל "?redirect=/admin"). */
  search: string;
  /** ה-origin הקנוני שנגזר מ-env, או null. */
  canonicalOrigin: string | null;
};

/**
 * החלטת ניתוב קנוני טהורה. מחזירה כתובת יעד מוחלטת (origin קנוני + path + query)
 * אם צריך להפנות, אחרת null (no-op). כללי ה-no-op:
 *  - אין origin קנוני מוגדר.
 *  - המתודה אינה GET/HEAD (לא מפנים POST / server actions / callbacks).
 *  - אין host בבקשה.
 *  - ה-origin הקנוני עצמו פנימי / לא תקין (הגנה מפני הפניה ל-localhost בפיתוח).
 *  - ה-host הנוכחי כבר תואם את ה-host הקנוני.
 *  - ה-host הנוכחי פנימי / loopback / IP (probes).
 */
export function canonicalRedirectTarget(input: CanonicalDecisionInput): string | null {
  const { method, host, pathname, search, canonicalOrigin } = input;
  if (!canonicalOrigin) return null;
  if (method !== 'GET' && method !== 'HEAD') return null;
  if (!host) return null;

  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOrigin).host;
  } catch {
    return null;
  }
  if (!canonicalHost) return null;

  // אם היעד הקנוני עצמו פנימי (למשל localhost בפיתוח), לא מפנים כלל.
  if (isInternalHost(canonicalHost)) return null;

  // כבר על ה-origin הקנוני, אין מה לעשות.
  if (host.toLowerCase() === canonicalHost.toLowerCase()) return null;

  // מארח פנימי / probe, לא מפנים.
  if (isInternalHost(host)) return null;

  return `${canonicalOrigin}${pathname}${search}`;
}
