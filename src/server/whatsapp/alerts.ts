/**
 * מיילי ההתראה של ממשל עלות הוואטסאפ.
 *
 * שני נמענים: מנהל-העל (SUPER_ADMIN_EMAIL) מקבל התראת חריגה כשעסק חוצה את סף
 * האזהרה (פעם אחת בחודש, לפי המשמר whatsappWarn40SentForMonth) ואת סף החסימה
 * (פעם אחת, ברגע המעבר לחסום). בעל העסק מקבל הודעה מנומסת שהוא חורג מהשימוש המומלץ
 * וכדאי להעדיף מייל.
 *
 * כל הפונקציות כאן לעולם אינן זורקות — כשל שליחת מייל אסור שיפיל את זרימת ההזמנה או
 * את שרשרת ההודעות. הן מחזירות boolean (נשלח/לא) לצרכי לוג בלבד.
 *
 * שפה: כל התוכן מול יניב בעברית RTL; כל אסימון לטיני (מזהה, סכום, כתובת) מבודד
 * בשורה נפרדת בכיוון LTR כדי שלא ישבור את הכיווניות.
 */

import { BRAND } from '@/config/brand';
import { sendEmail, emailConfigured } from '@/server/providers/email';
import { formatShekelFromAgorot } from './cost';
import type { WhatsAppConfig } from './config';

/** פרמטרים להתראת מנהל-על (אזהרה/חסימה). */
export interface SuperAdminAlertParams {
  config: WhatsAppConfig;
  businessId: string;
  businessName: string;
  month: string;
  costAgorot: number;
}

/** פרמטרים להודעת בעל העסק על חריגה. */
export interface OwnerNoticeParams {
  ownerEmail: string | null | undefined;
  businessName: string;
  month: string;
  costAgorot: number;
  blocked: boolean;
}

/** עוטף אסימון לטיני בשורת LTR מבודדת, כדי לשמור על כיווניות ה-RTL. */
function ltrLine(label: string, value: string): string {
  return (
    `<p style="margin:2px 0">${label}</p>` +
    `<p style="direction:ltr;text-align:left;margin:2px 0"><code>${value}</code></p>`
  );
}

/** מעטפת HTML אחידה בעברית RTL. */
function wrapHtml(inner: string): string {
  return (
    `<!doctype html><html lang="he" dir="rtl">` +
    `<body dir="rtl" style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    inner +
    `</body></html>`
  );
}

/**
 * שליחת מייל בטוחה שאינה זורקת. מחזירה false כשאין תצורת SMTP או כשהשליחה נכשלה,
 * true בהצלחה. אף פעם לא מפילה את הקורא.
 */
async function safeSend(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!to || !emailConfigured) return false;
  try {
    await sendEmail(to, subject, text, html);
    return true;
  } catch (err) {
    console.error(
      '[whatsapp:alerts] שליחת מייל התראה נכשלה',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * התראת מנהל-על על חציית סף האזהרה (ברירת מחדל 40₪) עבור עסק בחודש נתון.
 * נקראת פעם אחת בחודש לכל עסק (המשמר נאכף בשכבת הערוץ). לעולם אינה זורקת.
 */
export async function sendSuperAdminWarnEmail(params: SuperAdminAlertParams): Promise<boolean> {
  const shekel = formatShekelFromAgorot(params.costAgorot);
  const subject = `${BRAND.name} · אזהרת שימוש בוואטסאפ · ${params.businessName}`;
  const text =
    `העסק "${params.businessName}" חצה את סף האזהרה לשימוש בוואטסאפ בחודש ${params.month}. ` +
    `העלות המשוערת שנצברה: ${shekel} ש"ח. מזהה העסק: ${params.businessId}.`;
  const html = wrapHtml(
    `<p style="font-size:18px;font-weight:bold">אזהרת שימוש בוואטסאפ</p>` +
      `<p>העסק חצה את סף האזהרה החודשי לשימוש בערוץ הוואטסאפ, ומומלץ לעקוב אחר ההוצאה.</p>` +
      ltrLine('שם העסק:', params.businessName) +
      ltrLine('מזהה העסק:', params.businessId) +
      ltrLine('חודש:', params.month) +
      ltrLine('עלות משוערת שנצברה (ש"ח):', shekel) +
      `<p style="margin-top:12px">ניתן לצפות בפירוט בלוח מנהל-העל.</p>`,
  );
  return safeSend(params.config.superAdminEmail, subject, text, html);
}

/**
 * התראת מנהל-על על הגעה לסף החסימה (ברירת מחדל 45₪). נקראת פעם אחת ברגע המעבר
 * לחסום (שכבת הערוץ אוכפת את החד-פעמיות לפי מעבר הדגל). לעולם אינה זורקת.
 */
export async function sendSuperAdminBlockEmail(params: SuperAdminAlertParams): Promise<boolean> {
  const shekel = formatShekelFromAgorot(params.costAgorot);
  const subject = `${BRAND.name} · חסימת וואטסאפ אוטומטית · ${params.businessName}`;
  const text =
    `העסק "${params.businessName}" הגיע לסף החסימה לשימוש בוואטסאפ בחודש ${params.month} ` +
    `ונחסם אוטומטית. העלות המשוערת שנצברה: ${shekel} ש"ח. שליחות הוואטסאפ ייפלו למייל עד אישור חריגה. ` +
    `מזהה העסק: ${params.businessId}.`;
  const html = wrapHtml(
    `<p style="font-size:18px;font-weight:bold">חסימת וואטסאפ אוטומטית</p>` +
      `<p>העסק הגיע לסף החסימה החודשי ונחסם אוטומטית לשליחת וואטסאפ. ` +
      `ההודעות ייפלו לערוץ המייל עד לאישור חריגה בלוח מנהל-העל.</p>` +
      ltrLine('שם העסק:', params.businessName) +
      ltrLine('מזהה העסק:', params.businessId) +
      ltrLine('חודש:', params.month) +
      ltrLine('עלות משוערת שנצברה (ש"ח):', shekel) +
      `<p style="margin-top:12px">לאישור חריגה והסרת החסימה לחודש הנוכחי, יש להיכנס ללוח מנהל-העל.</p>`,
  );
  return safeSend(params.config.superAdminEmail, subject, text, html);
}

/**
 * הודעה לבעל העסק שהוא חורג מהשימוש המומלץ בוואטסאפ וכדאי להעדיף מייל. נשלחת
 * למייל בעל העסק (ownerEmail) אם קיים. לעולם אינה זורקת ומדלגת בחן ללא מייל.
 */
export async function sendOwnerUsageNoticeEmail(params: OwnerNoticeParams): Promise<boolean> {
  const to = params.ownerEmail?.trim();
  if (!to) return false;
  const shekel = formatShekelFromAgorot(params.costAgorot);
  const headline = params.blocked
    ? 'הגעתם לסף החסימה לשימוש בוואטסאפ'
    : 'שימו לב: חריגה מהשימוש המומלץ בוואטסאפ';
  const body = params.blocked
    ? `הגעתם לסף החסימה החודשי לשליחת הודעות וואטסאפ, ולכן ההודעות יישלחו בינתיים במייל. ` +
      `כדי לחדש שליחת וואטסאפ החודש, יש לפנות למנהל המערכת לאישור חריגה.`
    : `עברתם את סף השימוש החודשי המומלץ בערוץ הוואטסאפ. כדי לחסוך בעלויות, מומלץ להעדיף ` +
      `שליחה במייל להמשך החודש.`;
  const subject = `${BRAND.name} · ${headline}`;
  const text = `${body} העלות המשוערת שנצברה החודש (${params.month}): ${shekel} ש"ח.`;
  const html = wrapHtml(
    `<p style="font-size:18px;font-weight:bold">${headline}</p>` +
      `<p>${body}</p>` +
      ltrLine('חודש:', params.month) +
      ltrLine('עלות משוערת שנצברה (ש"ח):', shekel),
  );
  return safeSend(to, subject, text, html);
}
