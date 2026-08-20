/**
 * לוגיקה טהורה של קונסולת ניהול-העל (superadmin).
 * מודול חסר תלות במסגרת (ללא prisma / react / server-only) כדי שיהיה בר-בדיקה יחידה
 * וגם בטוח לייבוא הן משרת (page/actions/repos) והן מרכיב client (טופס מחיקה).
 */

/** מטריקות תפעוליות מצטברות לעסק בודד, בערכי אגורות (מספרים שלמים). */
export type BusinessMetrics = {
  clients: number;
  appointments: number;
  appointmentsValueAgorot: number;
  cashReceiptsAgorot: number;
};

export const EMPTY_METRICS: BusinessMetrics = {
  clients: 0,
  appointments: 0,
  appointmentsValueAgorot: 0,
  cashReceiptsAgorot: 0,
};

/** קלט מנורמל לבניית מפת המטריקות (נגזר משורות groupBy של prisma). */
export type MetricsShapeInput = {
  clientCounts: Array<{ businessId: string; count: number }>;
  appointmentCounts: Array<{ businessId: string; count: number }>;
  appointmentValues: Array<{ businessId: string; sumAgorot: number }>;
  cashReceipts: Array<{ businessId: string; sumAgorot: number }>;
};

/**
 * הרכבת מפת מטריקות לפי מזהה עסק מתוך מערכי אגרגציה נפרדים.
 * עסק שאין לו שורה בקבוצה כלשהי מקבל 0 באותו שדה (ברירת המחדל).
 */
export function shapeBusinessMetrics(input: MetricsShapeInput): Map<string, BusinessMetrics> {
  const map = new Map<string, BusinessMetrics>();
  const ensure = (businessId: string): BusinessMetrics => {
    let entry = map.get(businessId);
    if (!entry) {
      entry = { ...EMPTY_METRICS };
      map.set(businessId, entry);
    }
    return entry;
  };
  for (const row of input.clientCounts) ensure(row.businessId).clients = row.count;
  for (const row of input.appointmentCounts) ensure(row.businessId).appointments = row.count;
  for (const row of input.appointmentValues) {
    ensure(row.businessId).appointmentsValueAgorot = row.sumAgorot;
  }
  for (const row of input.cashReceipts) ensure(row.businessId).cashReceiptsAgorot = row.sumAgorot;
  return map;
}

/** שליפת מטריקות עסק מהמפה, עם נפילה למטריקות ריקות כשאין נתונים. */
export function metricsFor(map: Map<string, BusinessMetrics>, businessId: string): BusinessMetrics {
  return map.get(businessId) ?? EMPTY_METRICS;
}

/** המרת אגורות למחרוזת שקלים תמיד-מספרית (null/לא-סופי -> ₪0). */
export function formatShekelFromAgorot(agorot: number | null | undefined): string {
  const value = typeof agorot === 'number' && Number.isFinite(agorot) ? agorot : 0;
  const shekel = value / 100;
  return `₪${shekel.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

/** המרת אגורות לשקלים עם נפילה למקף כשאין ערך (למשל חיוב חודשי שלא הוגדר). */
export function formatShekelOrDash(agorot: number | null | undefined, dash = '—'): string {
  if (typeof agorot !== 'number' || !Number.isFinite(agorot)) return dash;
  return formatShekelFromAgorot(agorot);
}

/** תווית מספר הימים שנותרו (לא-שלילי; לא-פעיל מציג 0). */
export function formatDaysLeft(active: boolean, daysLeft: number): string {
  if (!active) return '0';
  const safe = Number.isFinite(daysLeft) ? Math.max(0, Math.round(daysLeft)) : 0;
  return String(safe);
}

/**
 * שומר אישור המחיקה: המזהה שהוקלד חייב להיות זהה ל-slug בפועל (אחרי trim),
 * וה-slug בפועל אינו יכול להיות ריק. מונע מחיקה בשוגג ומחיקה על ערך ריק.
 */
export function isSlugConfirmed(typed: string, actualSlug: string): boolean {
  const actual = actualSlug.trim();
  return actual.length > 0 && typed.trim() === actual;
}

export type EditBusinessRaw = {
  name: string;
  phone: string;
  ownerEmail: string;
  planNotes: string;
};

export type EditBusinessParsed = {
  name: string;
  phone: string | null;
  ownerEmail: string | null;
  planNotes: string | null;
};

export type EditBusinessResult =
  | { ok: true; data: EditBusinessParsed }
  | { ok: false; error: 'name' | 'email' };

/** בדיקת תקינות בסיסית לכתובת מייל (מספיק לשמירת פרטי בעלים). */
function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * ניקוי ואימות קלט עריכת פרטי עסק.
 * שם חובה; טלפון/מייל/הערה אופציונליים (ריק -> null). מייל שאינו ריק חייב להיות תקין.
 */
export function parseEditBusinessInput(raw: EditBusinessRaw): EditBusinessResult {
  const name = raw.name.trim();
  if (!name) return { ok: false, error: 'name' };
  const phone = raw.phone.trim() || null;
  const ownerEmailTrimmed = raw.ownerEmail.trim();
  const ownerEmail = ownerEmailTrimmed || null;
  if (ownerEmail && !isEmailish(ownerEmail)) return { ok: false, error: 'email' };
  const planNotes = raw.planNotes.trim() || null;
  return { ok: true, data: { name, phone, ownerEmail, planNotes } };
}
