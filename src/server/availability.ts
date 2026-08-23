import {
  localWallTimeToUtc,
  utcToLocalParts,
  weekdayForDateString,
  DEFAULT_TZ,
} from '@/lib/time';

/**
 * מנוע חישוב משבצות פנויות.
 *
 * הרעיון: לוקחים את שעות העבודה של איש הצוות ליום הרלוונטי, מחסירים הפסקות
 * ותורים קיימים, ומחלקים את מה שנשאר למשבצות ברזולוציה מבוקשת. כל החישוב
 * נעשה ב"דקות מתחילת היום המקומי", וההמרה ל-UTC נעשית רק בסוף.
 */

export type Interval = { start: number; end: number }; // דקות מתחילת היום

export type WorkingHoursInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breaks: [number, number][];
};

export type BusyInterval = { startAt: Date; endAt: Date };

export type SlotComputationParams = {
  dateStr: string; // "YYYY-MM-DD"
  workingHours: WorkingHoursInput[]; // כל השורות של אותו איש צוות
  busy: BusyInterval[]; // תורים קיימים (UTC)
  durationMin: number; // משך התור המבוקש
  slotGranularityMin: number; // צעד בין תחילות משבצות
  timeZone?: string;
  minLeadTimeMinutes?: number; // זמן מינימלי מראש
  now?: Date; // לצורך בדיקות
};

export type Slot = {
  startMinute: number; // דקות מתחילת היום המקומי
  label: string; // "HH:MM"
  startAtUtc: string; // ISO
  endAtUtc: string; // ISO
};

/** חיסור קבוצת אינטרוולים "תפוסים" מאינטרוול "פנוי" בודד. */
function subtractIntervals(base: Interval, blocks: Interval[]): Interval[] {
  let free: Interval[] = [{ ...base }];
  for (const block of blocks) {
    const next: Interval[] = [];
    for (const f of free) {
      if (block.end <= f.start || block.start >= f.end) {
        next.push(f); // אין חפיפה
        continue;
      }
      if (block.start > f.start) next.push({ start: f.start, end: block.start });
      if (block.end < f.end) next.push({ start: block.end, end: f.end });
    }
    free = next;
  }
  return free;
}

/** המרת רגע UTC לדקות מתחילת היום המקומי עבור תאריך היעד (עם קיזוז לימים אחרים). */
function busyToLocalMinutes(
  busy: BusyInterval,
  dateStr: string,
  timeZone: string,
): Interval | null {
  const startParts = utcToLocalParts(busy.startAt, timeZone);
  const endParts = utcToLocalParts(busy.endAt, timeZone);
  const startDate = `${startParts.year}-${String(startParts.month1).padStart(2, '0')}-${String(
    startParts.day,
  ).padStart(2, '0')}`;
  const endDate = `${endParts.year}-${String(endParts.month1).padStart(2, '0')}-${String(
    endParts.day,
  ).padStart(2, '0')}`;

  // אם התור כולו מחוץ ליום היעד — התעלם.
  if (endDate < dateStr || startDate > dateStr) return null;

  const start = startDate < dateStr ? 0 : startParts.minutes;
  const end = endDate > dateStr ? 24 * 60 : endParts.minutes;
  return { start, end };
}

export function computeSlots(params: SlotComputationParams): Slot[] {
  const {
    dateStr,
    workingHours,
    busy,
    durationMin,
    slotGranularityMin,
    timeZone = DEFAULT_TZ,
    minLeadTimeMinutes = 0,
    now = new Date(),
  } = params;

  if (durationMin <= 0) return [];

  const weekday = weekdayForDateString(dateStr, timeZone);
  const todaysHours = workingHours.filter((w) => w.weekday === weekday);
  if (todaysHours.length === 0) return [];

  // אינטרוולים תפוסים בדקות מקומיות: הפסקות + תורים קיימים.
  const busyLocal: Interval[] = [];
  for (const b of busy) {
    const iv = busyToLocalMinutes(b, dateStr, timeZone);
    if (iv) busyLocal.push(iv);
  }

  const earliestStartUtc = new Date(now.getTime() + minLeadTimeMinutes * 60_000);

  const [y, m, d] = dateStr.split('-').map(Number);
  const slots: Slot[] = [];

  for (const wh of todaysHours) {
    const breaks: Interval[] = (wh.breaks || []).map(([s, e]) => ({ start: s, end: e }));
    // מיישרים לרשת הרזולוציה פעם אחת — את תחילת חלון העבודה בלבד, כדי ששעת
    // פתיחה לא-עגולה (למשל 09:07) תתחיל במשבצת עגולה (09:15). לעומת זאת, חלון
    // שנפתח אחרי תור או הפסקה מתחיל מהרגע הפנוי עצמו (גב-אל-גב, בלי זמן מת).
    const alignedStart = Math.ceil(wh.startMinute / slotGranularityMin) * slotGranularityMin;
    if (alignedStart >= wh.endMinute) continue;
    const freeWindows = subtractIntervals(
      { start: alignedStart, end: wh.endMinute },
      [...breaks, ...busyLocal],
    );

    for (const win of freeWindows) {
      // כל חלון פנוי מתחיל מהרגע הפנוי עצמו: חלון תחילת היום כבר מיושר לרשת,
      // וחלון שאחרי תור מתחיל בדיוק כשהתור הקודם הסתיים.
      for (let start = win.start; start + durationMin <= win.end; start += slotGranularityMin) {
        const startAtUtc = localWallTimeToUtc(y, m, d, start, timeZone);
        if (startAtUtc < earliestStartUtc) continue; // כיבוד זמן מינימלי מראש
        const endAtUtc = new Date(startAtUtc.getTime() + durationMin * 60_000);
        slots.push({
          startMinute: start,
          label: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(
            start % 60,
          ).padStart(2, '0')}`,
          startAtUtc: startAtUtc.toISOString(),
          endAtUtc: endAtUtc.toISOString(),
        });
      }
    }
  }

  // מיון וייחוד לפי שעת התחלה.
  const seen = new Set<number>();
  return slots
    .sort((a, b) => a.startMinute - b.startMinute)
    .filter((s) => {
      if (seen.has(s.startMinute)) return false;
      seen.add(s.startMinute);
      return true;
    });
}
