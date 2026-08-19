/**
 * resolveReminderChannel — פונקציה טהורה (ללא DB) שגוזרת את ערוץ שליחת התזכורת
 * ואת יעד השליחה בפועל, מתוך זהות הלקוח והעדפת העסק.
 *
 * הרקע: לקוחות קצה נרשמים עם מייל או עם טלפון, ולכן אין באמת בחירה ידנית של ערוץ.
 * במצב AUTO הערוץ נגזר מאופן ההרשמה: אם ללקוח יש מייל התזכורת נשלחת במייל,
 * אחרת במסרון לפי הטלפון. עדיין ניתן לכפות ערוץ ידנית (EMAIL או SMS) כעקיפה,
 * אך אם ליעד הנדרש אין כתובת מתאימה מדלגים בבטחה עם סיבה.
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
): ResolvedReminderChannel {
  const email = clean(client.email);
  const phone = clean(client.phone);

  // עקיפה ידנית: מייל מפורש — מכבדים רק אם ללקוח יש כתובת מייל.
  if (businessPref === 'EMAIL') {
    if (email) return { kind: 'send', channel: 'EMAIL', to: email };
    return { kind: 'skip', reason: 'channel EMAIL requested but client has no email' };
  }

  // עקיפה ידנית: מסרון מפורש — מכבדים רק אם ללקוח יש טלפון.
  if (businessPref === 'SMS') {
    if (phone) return { kind: 'send', channel: 'SMS', to: phone };
    return { kind: 'skip', reason: 'channel SMS requested but client has no phone' };
  }

  // אוטומטי (AUTO) וכל ערך שאינו ערוץ שליחה קונקרטי (למשל PUSH): נגזר מזהות הלקוח,
  // בעדיפות למייל לפי אופן ההרשמה, אחרת טלפון.
  if (email) return { kind: 'send', channel: 'EMAIL', to: email };
  if (phone) return { kind: 'send', channel: 'SMS', to: phone };
  return { kind: 'skip', reason: 'client has neither email nor phone' };
}
