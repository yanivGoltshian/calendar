import { addDaysToDateString, localWallTimeToUtc, utcToLocalParts } from './time';

export function businessDate(now: Date, timeZone: string): string {
  const { year, month1, day } = utcToLocalParts(now, timeZone);
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function nextBusinessMidnight(now: Date, timeZone: string): Date {
  const [year, month, day] = addDaysToDateString(businessDate(now, timeZone), 1).split('-').map(Number);
  return localWallTimeToUtc(year, month, day, 0, timeZone);
}
