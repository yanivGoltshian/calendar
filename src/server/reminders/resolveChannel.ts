/**
 * resolveReminderChannel — פונקציה טהורה (ללא DB) שגוזרת את ערוץ שליחת התזכורת
 * ואת יעד השליחה בפועל, מתוך זהות הלקוח, העדפת העסק, והרשאת המסרון לפי החבילה.
 *
 * הרקע: לקוחות קצה נרשמים עם מייל או עם טלפון, ולכן אין באמת בחירה ידנית של ערוץ.
 * במצב AUTO הערוץ נגזר מאופן ההרשמה: אם ללקוח יש מייל התזכורת נשלחת במייל,
 * אחרת במסרון לפי הטלפון. עדיין ניתן לכפות ערוץ ידנית (EMAIL או SMS) כעקיפה,
 * אך אם ליעד הנדרש אין כתובת מתאימה מדלגים בבטחה עם סיבה.
 *
 * שער החבילה: המסרון בתשלום ללקוח דלוק רק בחבילת אקסקלוסיב. הפרמטר allowSms
 * מבטא זאת. כשהוא false, לעולם לא נגזר מסרון — עדיפות למייל, ואם אין מייל מדלגים
 * (לא נופלים למסרון). כך פרימיום ובסיס פונים ללקוח במייל בלבד, ולא מגיעים לערוץ
 * בתשלום. ברירת המחדל true נשמרת לתאימות לאחור עם קוראים שאינם מודעי דרגה.
 *
 * הפונקציה מקבלת את העדפת העסק כמחרוזת (ערך enum ReminderChannel) כדי להישאר
 * טהורה וללא תלות ב-Prisma, וכך ניתנת לבדיקה כיחידה ללא בסיס נתונים.
 */

export type ResolvableClient = {
  email?: string | null;
  phone?: string | null;
};

export type ResolvedReminderChannel =
  | { kind: 'send'; channel: 'EMAIL' | 'SMS'; to: string }
  | { kind: 'skip'; reason: string };

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveReminderChannel(
  client: ResolvableClient,
  businessPref: string,
  allowSms: boolean = true,
): ResolvedReminderChannel {
  const email = clean(client.email);
  const phone = clean(client.phone);

  // עקיפה ידנית: מייל מפורש — מכבדים רק אם ללקוח יש כתובת מייל.
  if (businessPref === 'EMAIL') {
    if (email) return { kind: 'send', channel: 'EMAIL', to: email };
    return { kind: 'skip', reason: 'channel EMAIL requested but client has no email' };
  }

  // עקיפה ידנית: מסרון מפורש — מכבדים רק אם המסרון מותר בחבילה וללקוח יש טלפון.
  if (businessPref === 'SMS') {
    if (allowSms) {
      if (phone) return { kind: 'send', channel: 'SMS', to: phone };
      return { kind: 'skip', reason: 'channel SMS requested but client has no phone' };
    }
    // המסרון בתשלום אינו דלוק בחבילה — נפילה למייל אם קיים, אחרת דילוג בטוח.
    if (email) return { kind: 'send', channel: 'EMAIL', to: email };
    return {
      kind: 'skip',
      reason: 'channel SMS requested but paid SMS is not enabled on this plan',
    };
  }

  // אוטומטי (AUTO) וכל ערך שאינו ערוץ שליחה קונקרטי (למשל PUSH): נגזר מזהות הלקוח,
  // בעדיפות למייל לפי אופן ההרשמה, אחרת מסרון — אך רק אם המסרון מותר בחבילה.
  if (email) return { kind: 'send', channel: 'EMAIL', to: email };
  if (phone && allowSms) return { kind: 'send', channel: 'SMS', to: phone };
  if (phone) {
    // ללקוח יש טלפון בלבד אך המסרון אינו דלוק בחבילה — מדלגים במקום ליפול למסרון.
    return {
      kind: 'skip',
      reason: 'client has no email and paid SMS is not enabled on this plan',
    };
  }
  return { kind: 'skip', reason: 'client has neither email nor phone' };
}
