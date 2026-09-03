import { BRAND } from '@/config/brand';
import { t } from '@/i18n';

/**
 * לוגיקת יידוע רשימת המתנה — פונקציות טהורות בלבד (ללא DB), כדי שניתן יהיה לבדוק
 * אותן ישירות. מודול זה מגדיר את ערוץ היידוע ללקוח ואת תוכן מייל "התפנה תור!".
 */

export type WaitlistNotifyChannel = 'sms' | 'email' | 'none';

/**
 * בורר ערוץ יידוע ללקוח:
 * - אקסקלוסיב → מסרון בתשלום (sms), גם אם קיים אימייל.
 * - לא-אקסקלוסיב עם אימייל תקין ברשומה → מייל.
 * - אחרת → ללא שליחה (סימון NOTIFIED בלבד, כמו ההתנהגות הקיימת).
 */
export function resolveWaitlistNotifyChannel(input: {
  isExclusive?: boolean;
  email?: string | null;
}): WaitlistNotifyChannel {
  if (input.isExclusive) return 'sms';
  if (input.email && input.email.trim().length > 0) return 'email';
  return 'none';
}

/** בריחת תווים ל-HTML — מונע הזרקת תגיות משם הלקוח (קלט משתמש) לגוף המייל. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * בונה את תוכן מייל היידוע "התפנה תור!" ללקוח: נושא, גוף טקסט וגוף HTML בכיווניות
 * עברית (dir="rtl"). שם הלקוח עובר escape ב-HTML. פונקציה טהורה — נשענת רק על i18n
 * ו-BRAND, ולכן ניתנת לבדיקה ללא תלות ב-SMTP או ב-DB.
 */
export function buildWaitlistNotifyEmail(clientName: string): {
  subject: string;
  text: string;
  html: string;
} {
  const nt = t.booking.waitlist.notifyEmail;
  const name = clientName.trim();
  const subject = `${BRAND.name} · ${nt.subject}`;
  const text = `${nt.greeting} ${name},\n${nt.body}`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right">` +
    `<h2>${escapeHtml(nt.heading)}</h2>` +
    `<p>${escapeHtml(nt.greeting)} ${escapeHtml(name)},</p>` +
    `<p>${escapeHtml(nt.body)}</p>` +
    `</body></html>`;
  return { subject, text, html };
}
