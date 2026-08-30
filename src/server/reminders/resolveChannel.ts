/**
 * resolveReminderTargets / resolveReminderChannel — פונקציות טהורות (ללא DB) שגוזרות
 * את יעדי שליחת התזכורת בפועל, מתוך זהות הלקוח, העדפת העסק, והרשאת המסרון לפי החבילה.
 *
 * הרקע: לקוחות קצה נרשמים עם מייל או עם טלפון. במצב AUTO הערוץ נגזר מאופן ההרשמה
 * ומהחבילה. עדיין ניתן לכפות ערוץ ידנית (EMAIL, SMS או BOTH) כעקיפה, אך אם ליעד
 * הנדרש אין כתובת מתאימה מדלגים בבטחה עם סיבה.
 *
 * שער החבילה: המסרון בתשלום ללקוח דלוק רק בחבילת אקסקלוסיב. הפרמטר allowSms מבטא
 * זאת (allowSms === true ⇔ אקסקלוסיב). כשהוא false, לעולם לא נגזר מסרון: אקסקלוסיב
 * מעדיף מסרון ואילו שאר החבילות פונות במייל בלבד. ברירת המחדל התלוית-חבילה:
 *  - אקסקלוסיב (allowSms): AUTO מעדיף מסרון (אם יש טלפון), אחרת מייל.
 *  - שאר החבילות: מייל בלבד (אם יש מייל), אחרת דילוג.
 *
 * BOTH (מייל ומסרון יחד) זמין רק לאקסקלוסיב: מחזיר עד שני יעדים. בחבילה שאינה
 * אקסקלוסיב הוא יורד למייל בלבד. הפונקציה מקבלת את העדפת העסק כמחרוזת (ערך enum
 * ReminderChannel) כדי להישאר טהורה וללא תלות ב-Prisma, וכך ניתנת לבדיקה כיחידה.
 */

export type ResolvableClient = {
  email?: string | null;
  phone?: string | null;
};

/** יעד שליחה קונקרטי אחד — ערוץ וכתובת. */
export type ReminderTarget = { channel: 'EMAIL' | 'SMS'; to: string };

export type ResolvedReminderChannel =
  | { kind: 'send'; channel: 'EMAIL' | 'SMS'; to: string }
  | { kind: 'skip'; reason: string };

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * גוזר את רשימת יעדי השליחה (0, 1 או 2 פריטים). זהו המפענח הקנוני — resolveReminderChannel
 * הוא מעטפת עליו לתאימות לאחור. רשימה ריקה משמעה דילוג; הסיבה נגזרת ב-reminderSkipReason.
 */
export function resolveReminderTargets(
  client: ResolvableClient,
  businessPref: string,
  allowSms: boolean = true,
): ReminderTarget[] {
  const email = clean(client.email);
  const phone = clean(client.phone);

  // עקיפה ידנית: מייל מפורש — רק אם ללקוח יש כתובת מייל.
  if (businessPref === 'EMAIL') {
    return email ? [{ channel: 'EMAIL', to: email }] : [];
  }

  // עקיפה ידנית: מסרון מפורש — רק אם המסרון מותר בחבילה וללקוח יש טלפון.
  // אם המסרון אינו דלוק בחבילה — נפילה למייל אם קיים.
  if (businessPref === 'SMS') {
    if (allowSms) return phone ? [{ channel: 'SMS', to: phone }] : [];
    return email ? [{ channel: 'EMAIL', to: email }] : [];
  }

  // מייל ומסרון יחד — זמין רק לאקסקלוסיב. בחבילה אחרת יורד למייל בלבד.
  if (businessPref === 'BOTH') {
    const targets: ReminderTarget[] = [];
    if (email) targets.push({ channel: 'EMAIL', to: email });
    if (allowSms && phone) targets.push({ channel: 'SMS', to: phone });
    return targets;
  }

  // אוטומטי (AUTO) וכל ערך שאינו ערוץ קונקרטי (למשל PUSH): נגזר מהחבילה ומזהות הלקוח.
  if (allowSms) {
    // אקסקלוסיב: ברירת מחדל מסרון (אם יש טלפון), אחרת מייל.
    if (phone) return [{ channel: 'SMS', to: phone }];
    if (email) return [{ channel: 'EMAIL', to: email }];
    return [];
  }
  // שאר החבילות: מייל בלבד.
  return email ? [{ channel: 'EMAIL', to: email }] : [];
}

/** מנסח סיבת דילוג עקבית כאשר אין אף יעד שליחה. */
function reminderSkipReason(
  client: ResolvableClient,
  businessPref: string,
  allowSms: boolean,
): string {
  const email = clean(client.email);
  const phone = clean(client.phone);

  if (businessPref === 'EMAIL') {
    return 'channel EMAIL requested but client has no email';
  }
  if (businessPref === 'SMS') {
    if (allowSms) return 'channel SMS requested but client has no phone';
    return 'channel SMS requested but paid SMS is not enabled on this plan';
  }
  // BOTH / AUTO / ערך לא מוכר: אם ללקוח יש טלפון בלבד והמסרון אינו דלוק בחבילה —
  // מדלגים במקום ליפול למסרון; אחרת הלקוח נטול מייל וטלפון כאחד.
  if (!allowSms && phone && !email) {
    return 'client has no email and paid SMS is not enabled on this plan';
  }
  return 'client has neither email nor phone';
}

/**
 * מעטפת תאימות לאחור: מחזירה את היעד הראשון שהוחזר מ-resolveReminderTargets, או דילוג
 * עם סיבה כאשר אין אף יעד. קוראים חדשים שצריכים שליחה כפולה (BOTH) יקראו ישירות
 * ל-resolveReminderTargets.
 */
export function resolveReminderChannel(
  client: ResolvableClient,
  businessPref: string,
  allowSms: boolean = true,
): ResolvedReminderChannel {
  const targets = resolveReminderTargets(client, businessPref, allowSms);
  const first = targets[0];
  if (first) return { kind: 'send', channel: first.channel, to: first.to };
  return { kind: 'skip', reason: reminderSkipReason(client, businessPref, allowSms) };
}
