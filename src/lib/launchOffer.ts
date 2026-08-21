// כלי ספירה-לאחור טהור למבצע ההשקה של הקליניקה. חסר תלות ב-DOM כדי שיהיה בר-בדיקה.
// פס המבצע מוסתר כברירת מחדל כשאין launchOffer; הרכיב הצרכן אחראי להסתרה.

export interface Countdown {
  expired: boolean; // האם המבצע הסתיים
  totalMs: number; // מילישניות שנותרו (0 אם הסתיים)
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// ממיר endsAt למועד סיום מוחלט. תאריך בלבד (YYYY-MM-DD) נחשב לסוף אותו יום ב-UTC
// כדי שהספירה תהיה דטרמיניסטית ולא תלוית אזור זמן. מחזיר NaN לקלט לא תקין.
export function resolveEndTime(endsAt: string): number {
  const trimmed = (endsAt ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Date.parse(`${trimmed}T23:59:59.999Z`);
  }
  return Date.parse(trimmed);
}

// מחשב את הזמן שנותר עד endsAt ביחס ל-now (ברירת מחדל: עכשיו).
// כאשר הקלט לא תקין או הזמן חלף — מוחזר מצב "הסתיים" עם אפסים.
export function computeCountdown(endsAt: string, now: number = Date.now()): Countdown {
  const end = resolveEndTime(endsAt);
  const remaining = Number.isNaN(end) ? 0 : end - now;
  if (!(remaining > 0)) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { expired: false, totalMs: remaining, days, hours, minutes, seconds };
}
