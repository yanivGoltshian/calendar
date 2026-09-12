import {
  localWallTimeToUtc,
  utcToLocalParts,
  weekdayForDateString,
  addDaysToDateString,
  formatDateString,
  DEFAULT_TZ,
} from '@/lib/time';

/**
 * מנוע חישוב משבצות פנויות.
 *
 * גבולות שעות העבודה נבחרים לפי השעון המקומי של העסק.
 * חיסור תורים והפסקות ומדידת משך השירות נעשים בזמן מוחלט, גם במעבר שעון.
 */

export type Interval = { start: number; end: number };

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

function wallBoundary(date: string, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  // A boundary in a DST gap advances to the first real minute, with a bounded search.
  for (let shift = 0; shift <= 180; shift++) {
    const value = minute + shift;
    const candidate = localWallTimeToUtc(year, month, day, value, timeZone);
    const expectedDate = value >= 1440 ? addDaysToDateString(date, 1) : date;
    if (formatDateString(candidate, timeZone) === expectedDate &&
        utcToLocalParts(candidate, timeZone).minutes === value % 1440) return candidate;
  }
  throw new Error('invalid_working_hours_boundary');
}

export function intervalFitsWorkingHours(
  startAt: Date, endAt: Date, date: string, hours: WorkingHoursInput[], timeZone: string,
): boolean {
  if (endAt <= startAt || formatDateString(startAt, timeZone) !== date) return false;
  const weekday = weekdayForDateString(date, timeZone);
  return hours.some((hour) => hour.weekday === weekday &&
    startAt >= wallBoundary(date, hour.startMinute, timeZone) &&
    endAt <= wallBoundary(date, hour.endMinute, timeZone) &&
    !hour.breaks.some(([start, end]) =>
      startAt < wallBoundary(date, end, timeZone) &&
      endAt > wallBoundary(date, start, timeZone)));
}

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

  if (durationMin <= 0 || slotGranularityMin <= 0) return [];

  const weekday = weekdayForDateString(dateStr, timeZone);
  const todaysHours = workingHours.filter((w) => w.weekday === weekday);
  if (todaysHours.length === 0) return [];

  const earliestStartUtc = new Date(now.getTime() + minLeadTimeMinutes * 60_000);
  const slots: Slot[] = [];

  for (const wh of todaysHours) {
    const closeUtc = wallBoundary(dateStr, wh.endMinute, timeZone);
    const breakUtc = wh.breaks.map(([start, end]) => ({
      startAt: wallBoundary(dateStr, start, timeZone),
      endAt: wallBoundary(dateStr, end, timeZone),
    }));
    // מיישרים לרשת הרזולוציה פעם אחת — את תחילת חלון העבודה בלבד, כדי ששעת
    // פתיחה לא-עגולה (למשל 09:07) תתחיל במשבצת עגולה (09:15). לעומת זאת, חלון
    // שנפתח אחרי תור או הפסקה מתחיל מהרגע הפנוי עצמו (גב-אל-גב, בלי זמן מת).
    const alignedStart = Math.ceil(wh.startMinute / slotGranularityMin) * slotGranularityMin;
    if (alignedStart >= wh.endMinute) continue;
    // Subtract and measure elapsed time in UTC so gaps/folds cannot shorten real bookings.
    const freeWindows = subtractIntervals(
      { start: wallBoundary(dateStr, alignedStart, timeZone).getTime(), end: closeUtc.getTime() },
      [...breakUtc, ...busy].map((block) => ({ start: block.startAt.getTime(), end: block.endAt.getTime() })),
    );

    for (const win of freeWindows) {
      // כל חלון פנוי מתחיל מהרגע הפנוי עצמו: חלון תחילת היום כבר מיושר לרשת,
      // וחלון שאחרי תור מתחיל בדיוק כשהתור הקודם הסתיים.
      for (let instant = win.start; instant + durationMin * 60_000 <= win.end; instant += slotGranularityMin * 60_000) {
        const startAtUtc = new Date(instant);
        const start = utcToLocalParts(startAtUtc, timeZone).minutes;
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
    .sort((a, b) => a.startMinute - b.startMinute || a.startAtUtc.localeCompare(b.startAtUtc))
    .filter((s) => {
      if (seen.has(s.startMinute)) return false;
      seen.add(s.startMinute);
      return true;
    });
}
