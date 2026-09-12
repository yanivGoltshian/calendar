import { z } from 'zod';
import { addDaysToDateString } from './time';

export const MAX_EXCEPTION_RULES = 200;
export const MAX_EXCEPTION_DAYS = 366;
export const HEBREW_MONTHS = [
  'TISHRI', 'HESHVAN', 'KISLEV', 'TEVET', 'SHEVAT', 'ADAR', 'ADAR_I', 'ADAR_II',
  'NISAN', 'IYAR', 'SIVAN', 'TAMUZ', 'AV', 'ELUL',
] as const;
export type HebrewMonth = typeof HEBREW_MONTHS[number];
const monthNames: Record<string, HebrewMonth> = {
  Tishri: 'TISHRI', Heshvan: 'HESHVAN', Kislev: 'KISLEV', Tevet: 'TEVET',
  Shevat: 'SHEVAT', Adar: 'ADAR', 'Adar I': 'ADAR_I', 'Adar II': 'ADAR_II',
  Nisan: 'NISAN', Iyar: 'IYAR', Sivan: 'SIVAN', Tamuz: 'TAMUZ', Av: 'AV', Elul: 'ELUL',
};
const hebrewFormatter = new Intl.DateTimeFormat('en-US-u-ca-hebrew', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
});

export function isGregorianDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && year <= 2200 &&
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function toHebrewDate(date: string) {
  if (!isGregorianDate(date)) throw new Error('invalid_date');
  const parts = hebrewFormatter.formatToParts(new Date(`${date}T12:00:00Z`));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const month = monthNames[value('month') ?? ''];
  if (!month) throw new Error('unsupported_hebrew_calendar');
  return { year: Number(value('year')), month, day: Number(value('day')) };
}

export function hebrewMonthMatches(actual: HebrewMonth, requested: string): boolean {
  // Generic Adar follows the last Adar; explicit Adar I/II occur only in leap years.
  return actual === requested || (requested === 'ADAR' && actual === 'ADAR_II');
}

/** Bounded inverse conversion using Node/browser ICU, with round-trip validation. */
export function fromHebrewDate(year: number, month: HebrewMonth, day: number): string {
  if (!Number.isInteger(year) || year < 5661 || year > 5960 ||
      !HEBREW_MONTHS.includes(month) || !Number.isInteger(day) || day < 1 || day > 30) {
    throw new Error('invalid_date');
  }
  const start = `${year - 3761}-08-01`;
  for (let offset = 0; offset < 430; offset++) {
    const date = addDaysToDateString(start, offset);
    const actual = toHebrewDate(date);
    if (actual.year === year && actual.day === day && hebrewMonthMatches(actual.month, month)) {
      return date;
    }
  }
  throw new Error('invalid_date');
}

const civilDate = z.string().refine(isGregorianDate);
const dateInput = z.discriminatedUnion('calendar', [
  z.object({ calendar: z.literal('GREGORIAN'), date: civilDate }).strict(),
  z.object({
    calendar: z.literal('HEBREW'), year: z.number().int().min(5661).max(5960),
    month: z.enum(HEBREW_MONTHS), day: z.number().int().min(1).max(30),
  }).strict(),
]);
export type ExceptionDateInput = z.infer<typeof dateInput>;
export function exceptionDateToGregorian(input: ExceptionDateInput): string {
  return input.calendar === 'GREGORIAN'
    ? input.date : fromHebrewDate(input.year, input.month, input.day);
}

export const exceptionInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  staffId: z.string().min(1).max(100).nullable(),
  start: dateInput,
  end: dateInput.optional(),
  recurrence: z.enum(['ONCE', 'WEEKLY', 'ANNUAL']),
  intervalWeeks: z.number().int().min(1).max(52).default(1),
  until: civilDate.nullable().default(null),
  closed: z.boolean(),
  startMinute: z.number().int().min(0).max(1439).nullable(),
  endMinute: z.number().int().min(1).max(1440).nullable(),
}).strict();
export type ExceptionInput = z.input<typeof exceptionInputSchema>;

export type ExceptionRule = {
  staffId: string | null;
  calendar: 'GREGORIAN' | 'HEBREW';
  recurrence: 'ONCE' | 'WEEKLY' | 'ANNUAL';
  startDate: string;
  endDate: string;
  intervalWeeks: number;
  until: string | null;
  annualMonth: string | null;
  annualDay: number | null;
  closed: boolean;
  startMinute: number | null;
  endMinute: number | null;
};

export function normalizeException(input: unknown): ExceptionRule & { title: string } {
  const parsed = exceptionInputSchema.parse(input);
  const startDate = exceptionDateToGregorian(parsed.start);
  const endDate = parsed.end ? exceptionDateToGregorian(parsed.end) : startDate;
  if (endDate < startDate ||
      endDate > addDaysToDateString(startDate, MAX_EXCEPTION_DAYS - 1) ||
      (parsed.recurrence !== 'ONCE' && endDate !== startDate) ||
      (parsed.until !== null && (parsed.until < startDate ||
        parsed.until > addDaysToDateString(startDate, 366 * 20))) ||
      (parsed.recurrence === 'ONCE' && parsed.until !== null) ||
      (parsed.recurrence !== 'WEEKLY' && parsed.intervalWeeks !== 1) ||
      (parsed.end && parsed.start.calendar !== parsed.end.calendar) ||
      (!parsed.closed && (parsed.startMinute === null || parsed.endMinute === null ||
        parsed.startMinute >= parsed.endMinute)) ||
      (parsed.closed && (parsed.startMinute !== null || parsed.endMinute !== null))) {
    throw new Error('invalid_exception');
  }
  return {
    title: parsed.title, staffId: parsed.staffId, calendar: parsed.start.calendar,
    recurrence: parsed.recurrence, startDate, endDate, until: parsed.until,
    intervalWeeks: parsed.intervalWeeks,
    annualMonth: parsed.recurrence !== 'ANNUAL' ? null
      : parsed.start.calendar === 'HEBREW' ? parsed.start.month : startDate.slice(5, 7),
    annualDay: parsed.recurrence !== 'ANNUAL' ? null
      : parsed.start.calendar === 'HEBREW' ? parsed.start.day : Number(startDate.slice(8, 10)),
    closed: parsed.closed, startMinute: parsed.startMinute, endMinute: parsed.endMinute,
  };
}

export function exceptionMatches(rule: ExceptionRule, date: string): boolean {
  if (date < rule.startDate || (rule.until !== null && date > rule.until)) return false;
  if (rule.recurrence === 'ONCE') return date <= rule.endDate;
  if (rule.recurrence === 'WEEKLY') {
    const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${rule.startDate}T00:00:00Z`)) / 86_400_000;
    return days % (7 * rule.intervalWeeks) === 0;
  }
  if (rule.calendar === 'GREGORIAN') {
    return date.slice(5, 7) === rule.annualMonth && Number(date.slice(8, 10)) === rule.annualDay;
  }
  const actual = toHebrewDate(date);
  return actual.day === rule.annualDay && hebrewMonthMatches(actual.month, rule.annualMonth ?? '');
}

export type DayHours = {
  weekday: number; startMinute: number; endMinute: number; breaks: [number, number][];
};

function intersection(a: DayHours[], b: DayHours[]): DayHours[] {
  return a.flatMap((left) => b.flatMap((right) => {
    const startMinute = Math.max(left.startMinute, right.startMinute);
    const endMinute = Math.min(left.endMinute, right.endMinute);
    return startMinute < endMinute
      ? [{ weekday: left.weekday, startMinute, endMinute, breaks: [...left.breaks, ...right.breaks] }] : [];
  }));
}

/** Full closures win; overlapping alternatives intersect, independent of creation order. */
export function resolveExceptionHours(
  regular: DayHours[], rules: ExceptionRule[], staffId: string, date: string,
  inheritsBusinessHours = true,
): DayHours[] {
  if (rules.length > MAX_EXCEPTION_RULES) throw new Error('exception_limit');
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const matching = rules.filter((rule) =>
    (rule.staffId === null || rule.staffId === staffId) && exceptionMatches(rule, date));
  if (!matching.length) return regular;
  if (matching.some((rule) => rule.closed)) return [];
  const windows = (rows: ExceptionRule[]): DayHours[] => rows.reduce<DayHours[]>(
    (hours, rule) => intersection(hours, [{
      weekday, startMinute: rule.startMinute!, endMinute: rule.endMinute!, breaks: [],
    }]), [{ weekday, startMinute: 0, endMinute: 1440, breaks: [] }],
  );
  const business = matching.filter((rule) => rule.staffId === null);
  const staff = matching.filter((rule) => rule.staffId === staffId);
  // Business alternatives replace inherited weekly hours and cap personal schedules.
  const base = staff.length ? windows(staff)
    : business.length && inheritsBusinessHours ? windows(business)
      : regular.filter((hour) => hour.weekday === weekday);
  return business.length ? intersection(base, windows(business)) : base;
}
