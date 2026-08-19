import { BRAND } from '@/config/brand';

/**
 * שכבת שליחת מייל עבור קודי אימות (OTP) לבעלי עסק וללקוחות.
 *
 * הפרדה מכוונת משכבת ההודעות (SMS/וואטסאפ) שב-messaging.ts: מייל הוא ערוץ
 * זהות אופציונלי ונוסף, והוא תמיד פעיל עם נפילה בטוחה ללוג בסביבת פיתוח.
 *
 * בחירת המתאם לפי משתני הסביבה:
 *   EMAIL_SERVER  (אופציונלי) כתובת SMTP בפורמט URL, למשל
 *                 smtp://user:pass@smtp.example.com:587 . כשמוגדר — נשלח מייל אמיתי.
 *   EMAIL_FROM    (אופציונלי) כתובת השולח, למשל "תור צ׳יק <no-reply@example.com>".
 *
 * כשאין EMAIL_SERVER מוגדר, הספק אינו נכשל: הוא מדפיס את הקוד ללוג בפורמט
 * `[email:console] to=<addr> code=<123456>` (במקביל ל-console stub של ה-SMS),
 * כדי לאפשר בדיקות מקצה-לקצה בלי חשבון SMTP אמיתי, ושהאפליקציה תיבנה ותרוץ.
 */

const EMAIL_SERVER = process.env.EMAIL_SERVER?.trim();
const EMAIL_FROM = process.env.EMAIL_FROM?.trim();

/** האם הוגדר ספק מייל אמיתי (SMTP). כשfalse — נעשה שימוש בנפילת ה-console. */
export const emailConfigured = Boolean(EMAIL_SERVER && EMAIL_FROM);

/** תוכן הודעת קוד האימות (נושא + גוף טקסט + HTML) בעברית. */
function buildOtpMessage(code: string): { subject: string; text: string; html: string } {
  const subject = `${BRAND.name} · קוד האימות שלך`;
  const text = `קוד האימות שלך אל ${BRAND.name} הוא ${code}. הקוד תקף ל-5 דקות. אם לא ביקשת קוד, אפשר להתעלם מהודעה זו.`;
  const html = `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl">`
    + `<p>קוד האימות שלך אל <strong>${BRAND.name}</strong>:</p>`
    + `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>`
    + `<p>הקוד תקף ל-5 דקות. אם לא ביקשת קוד, אפשר להתעלם מהודעה זו.</p>`
    + `</body></html>`;
  return { subject, text, html };
}

/**
 * שליחת קוד OTP בן שש ספרות לכתובת מייל.
 *
 * לעולם אינו זורק שגיאה בגלל תצורה חסרה: אם אין SMTP — מדפיס ללוג (fallback).
 * אם SMTP מוגדר אך השליחה נכשלת — השגיאה מטופלת בקריאה (route) שמחליט אם
 * לחשוף כשל למשתמש; כאן אנו זורקים רק במקרה של כשל SMTP אמיתי.
 */
export async function sendEmailOtp(to: string, code: string): Promise<void> {
  if (!emailConfigured) {
    // נפילת פיתוח בטוחה: הדפסת הקוד ללוג בלבד, ללא כשל.
    console.info(`[email:console] to=${to} code=${code}`);
    return;
  }

  const { subject, text, html } = buildOtpMessage(code);

  // ייבוא דינמי כדי שהאפליקציה תיבנה ותרוץ גם בלי חבילת nodemailer בזמן ריצה
  // כאשר מייל אינו בשימוש (למשל בילד שבו התלות לא הותקנה).
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(EMAIL_SERVER as string);
  await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html });
}

/**
 * שליחת מייל תזכורת כללי (נושא + גוף טקסט + HTML) דרך אותה תשתית SMTP.
 * מיועד לשכבת התזכורות (send.ts). כמו sendEmailOtp: כשאין SMTP מוגדר — נפילת
 * console בטוחה שאינה זורקת. שכבת השליחה בודקת את emailConfigured לפני הקריאה
 * ומדלגת בחן כשאין תצורה, כדי שלא נדווח "נשלח" כשרק נכתב ללוג.
 */
export async function sendReminderEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  if (!emailConfigured) {
    // נפילת פיתוח בטוחה: תיעוד ללוג בלבד, ללא כשל.
    console.info(`[email:console] reminder to=${to} subject=${subject}`);
    return;
  }

  // ייבוא דינמי — ראו ההערה ב-sendEmailOtp.
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(EMAIL_SERVER as string);
  await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html });
}

/**
 * שליחת מייל דיוור כללי (קמפיינים) דרך אותה תשתית SMTP.
 * בניגוד ל-sendReminderEmail — כאן נפילת ה-console *כן* נחשבת נשלחה, כי בקמפיינים
 * מצב ה-console הוא מתאם הפיתוח המכוון (ברירת המחדל כשאין תצורת ספק חי). אם SMTP
 * מוגדר והשליחה נכשלת — השגיאה מתפשטת לקורא (שכבת המסירה) שמסמן את הנמען ככשל.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  if (!emailConfigured) {
    // מתאם פיתוח: כתיבה ללוג בלבד (ברירת המחדל של מצב ה-console לקמפיינים).
    console.info(`[email:console] campaign to=${to} subject=${subject}`);
    return;
  }

  // ייבוא דינמי — ראו ההערה ב-sendEmailOtp.
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(EMAIL_SERVER as string);
  await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html: html ?? text });
}
