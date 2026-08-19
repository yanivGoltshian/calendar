/**
 * מיפוי קודי שגיאה של Auth.js (NextAuth v5) למפתח הודעה ידידותי בעברית.
 *
 * NextAuth מפנה שגיאות אימות לעמוד `pages.error` עם `?error=<Code>`. אנחנו מפנים אותן
 * לעמוד הכניסה `/business/login` (שנשלט ע"י ה-middleware הקנוני), וכך המשתמש רואה הודעה
 * ברורה בעברית ומנסה שוב מהמקור הקנוני. פונקציה טהורה זו ממפה את הקוד למפתח יציב;
 * מחרוזות ה-UI עצמן נשמרות ב-`src/i18n/he.ts` (הפרדה בין לוגיקה לתרגום).
 *
 * הקוד השכיח בבאג שדווח הוא `Configuration` (למשל פיצול origin שמאבד את עוגיית ה-PKCE
 * בחזרה מ-Google). ראו את ה-middleware הקנוני ב-`src/middleware.ts`.
 */

export type AuthErrorKey =
  | 'configuration'
  | 'oauth'
  | 'accessDenied'
  | 'verification'
  | 'generic';

export function describeAuthError(code: string | null | undefined): AuthErrorKey | null {
  if (!code) return null;
  switch (code) {
    case 'Configuration':
      return 'configuration';
    case 'AccessDenied':
      return 'accessDenied';
    case 'Verification':
      return 'verification';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCallbackError':
    case 'OAuthCreateAccount':
    case 'OAuthAccountNotLinked':
    case 'Callback':
      return 'oauth';
    default:
      return 'generic';
  }
}
