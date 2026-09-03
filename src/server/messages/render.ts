import { prisma } from '@/lib/db';
import {
  DEFAULT_BRAND,
  type MessageChannel,
  type MessageKey,
} from './registry';

/**
 * מנוע הרינדור של הודעות ללקוח-קצה. עיקרון מנחה: "fallback-first" + תאימות מלאה
 * לאחור.
 *
 * לכל בנאי הודעה קיים כבר פלט "ברירת מחדל" (טקסט + HTML עשיר). renderMessage
 * מקבל את הפלט הזה כ-fallback, ומחזיר אותו כפי שהוא כאשר אין דריסת-בעלים —
 * ולכן כשאין נתונים חדשים הפלט זהה בייט-בבייט להיום, כולל ה-HTML העשיר של
 * אישורי ההזמנה/התור. רק כשקיימת דריסה שהבעלים ערך, אנו מרנדרים את הטקסט שהבעלים
 * הזין (טקסט רגיל בלבד), עוטפים אותו במעטפת RTL בטוחה ומבריחים HTML — כך שהבעלים
 * לעולם אינו יכול להזריק HTML.
 *
 * טעינת הדריסה מוגנת בבדיקת סביבה: ללא DATABASE_URL (בדיקות/בנייה) לא מתבצעת
 * שאילתה כלל, ולכן ההתנהגות הקיימת והבדיקות אינן מושפעות. הדריסות פעילות רק
 * בפרודקשן מול DB אמיתי. בבדיקות מזריקים loader מזויף כדי לבדוק את נתיב הדריסה.
 */

export interface RenderedMessage {
  subject?: string;
  text: string;
  html?: string;
}

/** פלט ברירת המחדל של הבנאי הקיים, המשמש כ-fallback כשאין דריסה. */
export interface MessageFallback {
  subject?: string;
  text: string;
  html?: string;
}

/** שורת דריסה שנטענה (או null אם אין). subject אופציונלי (למייל בלבד). */
export interface TemplateOverride {
  subject?: string | null;
  body: string;
}

/** חתימת פונקציית הטעינה — ניתנת להזרקה בבדיקות. */
export type OverrideLoader = (
  businessId: string,
  key: MessageKey,
  channel: MessageChannel,
) => Promise<TemplateOverride | null>;

/** בריחת תווים ל-HTML — זהה לדפוס שב-waitlistNotify (חמישה תווים). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * מחליף מצייני-מיקום {{var}} מתוך מפת הערכים. רווחים סביב השם מותרים
 * ({{ var }}). מצייני-מיקום לא מוכרים מוחלפים במחרוזת ריקה.
 */
export function substitute(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    const value = vars[name];
    return value == null ? '' : String(value);
  });
}

/**
 * עוטף טקסט רגיל (לאחר escape) במעטפת מייל RTL עברית זהה לזו של הבנאים הקיימים.
 * שוברי שורה (\n) הופכים ל-<br/>. משמש רק בנתיב הדריסה, שבו הבעלים הזין טקסט רגיל.
 */
export function rtlShell(text: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, '<br/>');
  return (
    `<!doctype html><html lang="he" dir="rtl">` +
    `<body style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right">` +
    `<p>${escaped}</p>` +
    `</body></html>`
  );
}

/**
 * טעינת שורת הדריסה מה-DB — מוגנת בסביבה. ללא DATABASE_URL מחזירה null מיד (אין
 * שאילתה). כל שגיאה נבלעת ומוחזר null (best-effort), כדי ששכבת ההודעות לעולם לא
 * תפיל שליחה בגלל תקלת DB.
 */
export const defaultOverrideLoader: OverrideLoader = async (
  businessId,
  key,
  channel,
) => {
  if (!process.env.DATABASE_URL) return null;
  try {
    const row = await prisma.messageTemplate.findUnique({
      where: {
        businessId_key_channel: { businessId, key, channel },
      },
      select: { subject: true, body: true },
    });
    return row ?? null;
  } catch {
    return null;
  }
};

/**
 * מרנדר הודעה ללקוח.
 *
 * @param businessId מזהה העסק לטעינת דריסה. null/undefined → דילוג על DB והחזרת
 *   ה-fallback כפי שהוא (למשל OTP, שאינו משויך לעסק).
 * @param key מפתח ההודעה.
 * @param channel הערוץ ('email' | 'sms').
 * @param vars ערכי המשתנים להצבה בטקסט הדריסה. {{brand}} מקבל ברירת-מחדל אם חסר.
 * @param fallback פלט הבנאי הקיים — מוחזר כפי שהוא כשאין דריסה.
 * @param load פונקציית טעינה (ברירת מחדל: defaultOverrideLoader). ניתנת להזרקה בבדיקות.
 */
export async function renderMessage(
  businessId: string | null | undefined,
  key: MessageKey,
  channel: MessageChannel,
  vars: Record<string, string | null | undefined>,
  fallback: MessageFallback,
  load: OverrideLoader = defaultOverrideLoader,
): Promise<RenderedMessage> {
  // ללא הקשר עסק — אין דריסה אפשרית, מחזירים את ברירת המחדל של הבנאי.
  if (!businessId) return { ...fallback };

  const override = await load(businessId, key, channel);
  if (!override) return { ...fallback };

  // ערכי המשתנים, עם ברירת-מחדל לשם המותג.
  const filled: Record<string, string | null | undefined> = {
    brand: DEFAULT_BRAND,
    ...vars,
  };

  const text = substitute(override.body, filled);

  const result: RenderedMessage = { text };

  if (channel === 'email') {
    const subjectSource = override.subject ?? fallback.subject;
    if (subjectSource != null) {
      result.subject = substitute(subjectSource, filled);
    }
    // המייל נבנה מטקסט רגיל בלבד: escape + מעטפת RTL. הבעלים אינו יכול להזריק HTML.
    result.html = rtlShell(text);
  }

  return result;
}
