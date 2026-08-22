/**
 * גזירת ערוצי התקשורת המותרים לפי חבילת העסק (tier gating).
 *
 * המבנה: Standard (basic) — אין ערוצים; Premium — מייל בלבד; Exclusive — וואטסאפ
 * עם נפילה למייל. הפונקציה מקבלת את שם החבילה כמחרוזת (לא כ-enum) בכוונה, כדי לא
 * להיצמד לערך ה-enum exclusive שנוסף בסשן ה-tier המקביל; היא מזהה exclusive לפי
 * המחרוזת בלבד, כך שהיא עובדת גם לפני וגם אחרי ה-rebase.
 *
 * חשוב: ערוץ הוואטסאפ שמור לחבילת Exclusive בלבד. אם סשן ה-tier השאיר stub של SMS
 * לחבילת Exclusive, שכבת הערוץ הזו מחליפה אותו בוואטסאפ, והעותק מול המשתמש מתעדכן
 * מ-"SMS" ל"וואטסאפ".
 */

/** אילו ערוצים מותרים לחבילה נתונה. */
export interface TierChannels {
  /** האם וואטסאפ מותר (חבילת Exclusive בלבד). */
  whatsapp: boolean;
  /** האם מייל מותר (Premium ומעלה). */
  email: boolean;
}

/** נרמול שם החבילה: אותיות קטנות, ללא רווחים. */
function normalizePlan(plan: string | null | undefined): string {
  return (plan ?? '').trim().toLowerCase();
}

/**
 * מחזיר את הערוצים המותרים לחבילה. exclusive => וואטסאפ + מייל (נפילה);
 * premium => מייל בלבד; כל השאר (basic/standard/ריק) => ללא ערוצים.
 */
export function resolveTierChannels(plan: string | null | undefined): TierChannels {
  switch (normalizePlan(plan)) {
    case 'exclusive':
      return { whatsapp: true, email: true };
    case 'premium':
      return { whatsapp: false, email: true };
    default:
      return { whatsapp: false, email: false };
  }
}

/** האם החבילה כוללת את ערוץ הוואטסאפ (Exclusive). */
export function tierAllowsWhatsApp(plan: string | null | undefined): boolean {
  return resolveTierChannels(plan).whatsapp;
}
