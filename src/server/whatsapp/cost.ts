/**
 * לוגיקת ממשל העלות של ערוץ הוואטסאפ — טהורה וניתנת לבדיקה (ללא DB, ללא רשת).
 *
 * המודל: לכל עסק צובר עלות משוער חודשי (אגורות) הנשמר לצד "חודש הצבירה"
 * (whatsappCostMonth, בפורמט YYYY-MM). כאשר החודש מתגלגל, הצובר מתאפס. על כל
 * שליחה מוצלחת מוסיפים את התעריף. שני ספים: אזהרה (ברירת מחדל 40₪) וחסימה
 * (ברירת מחדל 45₪). בחסימה — שליחות נוספות נדחות (נפילה למייל) עד שמנהל-על מאשר
 * חריגה לאותו חודש.
 *
 * כל החישובים כאן טהורים; שכבת הערוץ (channel.ts) מתרגמת את התוצאה לעדכוני Prisma
 * ולתופעות לוואי (מיילי התראה).
 */

/** ברירת המחדל לאזור הזמן לחלוקת החודשים — שעון ישראל. */
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

/** מצב צובר העלות של עסק (תת-קבוצת שדות ה-Business הרלוונטיים). */
export interface BusinessCostState {
  monthlyWhatsappCostAgorot: number;
  whatsappCostMonth: string | null;
  whatsappBlocked: boolean;
  whatsappWarn40SentForMonth: string | null;
  whatsappOverrideApprovedForMonth: string | null;
}

/** סיווג מצב העסק מול הספים, לצורך תגית בלוח מנהל-העל. */
export type CostStatus = 'ok' | 'warn' | 'blocked';

/**
 * מחזיר את החודש הנוכחי בפורמט YYYY-MM לפי אזור זמן (ברירת מחדל שעון ישראל).
 * שימוש ב-Intl כדי לחלק לחודשים קלנדריים נכונים גם סביב מעברי חודש/שעון.
 */
export function currentMonth(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `${year}-${month}`;
}

/**
 * הצובר האפקטיבי של העסק עבור חודש נתון: אם חודש הצבירה שונה מהחודש המבוקש —
 * החודש התגלגל והצובר מתאפס ל-0; אחרת הערך השמור.
 */
export function effectiveMonthlyCost(state: BusinessCostState, month: string): number {
  return state.whatsappCostMonth === month ? state.monthlyWhatsappCostAgorot : 0;
}

/**
 * האם העסק חסום לשליחת וואטסאפ עבור החודש הנתון (שער טרום-שליחה).
 * חסום כאשר: חודש הצבירה תואם, אין אישור חריגה לאותו חודש, והדגל חסום או שהצובר
 * חצה את סף החסימה. מעבר חודש מאפס את החסימה (חודש חדש מתחיל נקי).
 */
export function isBlockedForMonth(
  state: BusinessCostState,
  month: string,
  blockAgorot: number,
): boolean {
  // חודש התגלגל => לא חסום (צובר מתאפס לחודש החדש).
  if (state.whatsappCostMonth !== month) return false;
  // אושרה חריגה לחודש זה => לא חסום.
  if (state.whatsappOverrideApprovedForMonth === month) return false;
  return state.whatsappBlocked || state.monthlyWhatsappCostAgorot >= blockAgorot;
}

/** סיווג מצב מול הספים לפי צובר נתון (לתגית הלוח). */
export function classifyStatus(
  totalAgorot: number,
  warnAgorot: number,
  blockAgorot: number,
): CostStatus {
  if (totalAgorot >= blockAgorot) return 'blocked';
  if (totalAgorot >= warnAgorot) return 'warn';
  return 'ok';
}

/**
 * ממיר אגורות (מספר שלם) למחרוזת שקלים לתצוגה, למשל 4000 => "40.00".
 * שומר על שתי ספרות אחרי הנקודה כדי למנוע היסחפות float בתצוגה.
 */
export function formatShekelFromAgorot(agorot: number): string {
  return (Math.round(agorot) / 100).toFixed(2);
}

/** תוצאת חישוב שליחה מוצלחת: הצובר החדש, עדכוני ה-DB, ודגלי תופעות הלוואי. */
export interface SuccessfulSendOutcome {
  /** הצובר לאחר הוספת התעריף (אגורות). */
  newTotalAgorot: number;
  /** שדות ה-Business לעדכון ב-Prisma (חלקי, additive). */
  update: Partial<BusinessCostState>;
  /** האם חצינו כעת את סף האזהרה בפעם הראשונה החודש (יש לשלוח מייל התראה פעם אחת). */
  crossedWarn: boolean;
  /** האם הגענו כעת לסף החסימה (יש לחסום ולפול למייל מכאן והלאה). */
  reachedBlock: boolean;
}

/**
 * מחשב את תוצאת הוספת עלות של שליחה מוצלחת אחת: מגלגל/מאפס את הצובר לפי החודש,
 * מוסיף את התעריף, וקובע האם נחצה סף האזהרה (פעם אחת בחודש, לפי המשמר) והאם הגענו
 * לסף החסימה. אינו נוגע ב-DB — רק מחזיר את מה שיש לשמור ואת דגלי תופעות הלוואי.
 */
export function applySuccessfulSend(
  state: BusinessCostState,
  month: string,
  rateAgorot: number,
  warnAgorot: number,
  blockAgorot: number,
): SuccessfulSendOutcome {
  const rolled = state.whatsappCostMonth !== month;
  const base = rolled ? 0 : state.monthlyWhatsappCostAgorot;
  const newTotal = base + Math.max(0, rateAgorot);

  // המשמר של מייל האזהרה שייך לחודש הצבירה; במעבר חודש הוא מתאפס.
  const warnGuard = rolled ? null : state.whatsappWarn40SentForMonth;
  const crossedWarn = newTotal >= warnAgorot && warnGuard !== month;
  const reachedBlock = newTotal >= blockAgorot;

  const update: Partial<BusinessCostState> = {
    monthlyWhatsappCostAgorot: newTotal,
    whatsappCostMonth: month,
  };
  // מעבר חודש מנקה את דגל החסימה (חודש חדש מתחיל ללא חסימה).
  if (rolled && state.whatsappBlocked) {
    update.whatsappBlocked = false;
  }
  if (crossedWarn) {
    update.whatsappWarn40SentForMonth = month;
  }
  if (reachedBlock) {
    update.whatsappBlocked = true;
  }

  return { newTotalAgorot: newTotal, update, crossedWarn, reachedBlock };
}
