import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeSlots, type WorkingHoursInput, type BusyInterval } from './availability';
import { weekdayForDateString, localWallTimeToUtc } from '@/lib/time';

/**
 * בדיקות למנוע חישוב המשבצות (computeSlots).
 * כל הבדיקות נעשות באזור הזמן Asia/Jerusalem (ברירת המחדל).
 */

const TZ = 'Asia/Jerusalem';
// יום קיץ (היסט +3 מ-UTC) — יום שני.
const SUMMER_DATE = '2026-06-15';
// זמן "עכשיו" רחוק בעבר כדי לנטרל את סינון הזמן-מראש בבדיקות שאינן בודקות אותו.
const FAR_PAST = new Date('2020-01-01T00:00:00Z');

/** בונה שורת שעות עבודה ליום השבוע של התאריך הנתון. */
function hoursForDate(
  dateStr: string,
  startMinute: number,
  endMinute: number,
  breaks: [number, number][] = [],
): WorkingHoursInput {
  return { weekday: weekdayForDateString(dateStr, TZ), startMinute, endMinute, breaks };
}

test('אין שעות עבודה כלל → מחזיר []', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.deepEqual(slots, []);
});

test('אין שעות ליום השבוע המבוקש → מחזיר []', () => {
  // שורה ליום אחר בלבד (weekday+1) — היום המבוקש נשאר ריק.
  const otherWeekday = (weekdayForDateString(SUMMER_DATE, TZ) + 1) % 7;
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [{ weekday: otherWeekday, startMinute: 540, endMinute: 1020, breaks: [] }],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.deepEqual(slots, []);
});

test('משך שירות אפס או שלילי → מחזיר []', () => {
  const base = {
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 540, 1020)],
    busy: [] as BusyInterval[],
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  };
  assert.deepEqual(computeSlots({ ...base, durationMin: 0 }), []);
  assert.deepEqual(computeSlots({ ...base, durationMin: -30 }), []);
});

test('שירות 30 דק׳, 09:00–17:00, רזולוציה 15 → משבצת ראשונה 09:00 ואחרונה 16:30', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 17 * 60)],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.equal(slots.length, 31);
  assert.equal(slots[0].label, '09:00');
  assert.equal(slots[slots.length - 1].label, '16:30');
  // המשבצות ממוינות ועולות.
  for (let i = 1; i < slots.length; i++) {
    assert.ok(slots[i].startMinute > slots[i - 1].startMinute);
  }
});

test('יישור לרשת הרזולוציה: התחלה 09:07 מתעגלת כלפי מעלה ל-09:15', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60 + 7, 17 * 60)],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.equal(slots[0].label, '09:15');
});

test('גבול משך מול שעת הסגירה: חלון של שעה עם שירות 60 דק׳ → משבצת אחת בדיוק', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 10 * 60)],
    busy: [],
    durationMin: 60,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].label, '09:00');
});

test('גבול משך מול שעת הסגירה: חלון קצר מהשירות → []', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 9 * 60 + 30)],
    busy: [],
    durationMin: 60,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.deepEqual(slots, []);
});

test('הפסקה מוסרת מהחלון: אין משבצות בתוך 12:00–13:00', () => {
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 17 * 60, [[12 * 60, 13 * 60]])],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 30,
    timeZone: TZ,
    now: FAR_PAST,
  });
  const labels = slots.map((s) => s.label);
  assert.ok(labels.includes('11:30'));
  assert.ok(!labels.includes('12:00'));
  assert.ok(!labels.includes('12:30'));
  assert.ok(labels.includes('13:00'));
});

test('תור קיים חוסם משבצות: 10:00–11:00 תפוס', () => {
  const busy: BusyInterval[] = [
    {
      startAt: localWallTimeToUtc(2026, 6, 15, 10 * 60, TZ),
      endAt: localWallTimeToUtc(2026, 6, 15, 11 * 60, TZ),
    },
  ];
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 17 * 60)],
    busy,
    durationMin: 30,
    slotGranularityMin: 30,
    timeZone: TZ,
    now: FAR_PAST,
  });
  const labels = slots.map((s) => s.label);
  assert.ok(labels.includes('09:30'));
  assert.ok(!labels.includes('10:00'));
  assert.ok(!labels.includes('10:30'));
  assert.ok(labels.includes('11:00'));
});

test('זמן מינימלי מראש (min-lead) חותך משבצות מוקדמות', () => {
  // "עכשיו" = 09:00 מקומי; lead=120 דק׳ → המשבצת הראשונה האפשרית 11:00.
  const now = localWallTimeToUtc(2026, 6, 15, 9 * 60, TZ);
  const slots = computeSlots({
    dateStr: SUMMER_DATE,
    workingHours: [hoursForDate(SUMMER_DATE, 9 * 60, 17 * 60)],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    minLeadTimeMinutes: 120,
    now,
  });
  const labels = slots.map((s) => s.label);
  assert.equal(slots[0].label, '11:00');
  assert.ok(!labels.includes('09:00'));
  assert.ok(!labels.includes('10:45'));
});

test('computeSlots אינו אוכף חלון-הזמנה-מקסימלי: תאריך רחוק עדיין מחזיר משבצות', () => {
  // אכיפת max-advance נעשית בנתיב ההזמנה (route), לא במנוע המשבצות.
  const farDate = '2027-01-01';
  const slots = computeSlots({
    dateStr: farDate,
    workingHours: [hoursForDate(farDate, 9 * 60, 17 * 60)],
    busy: [],
    durationMin: 30,
    slotGranularityMin: 30,
    timeZone: TZ,
    now: FAR_PAST,
  });
  assert.ok(slots.length > 0);
});
