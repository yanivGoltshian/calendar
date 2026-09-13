import {
  normalizeWorkingHoursRows,
  WorkingHoursValidationError,
  type WorkingHoursRow,
} from './workingHours';

function parseHHMM(value: FormDataEntryValue | null): number | null {
  const input = String(value ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return 1440;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseWorkingHoursForm(formData: FormData): WorkingHoursRow[] {
  const rows: WorkingHoursRow[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (formData.get(`open_${weekday}`) !== 'on') continue;

    const startMinute = parseHHMM(formData.get(`start_${weekday}`));
    const endMinute = parseHHMM(formData.get(`end_${weekday}`));
    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      throw new WorkingHoursValidationError('range');
    }

    const starts = formData.getAll(`breakStart_${weekday}`);
    const ends = formData.getAll(`breakEnd_${weekday}`);
    const breaks: [number, number][] = [];
    for (let index = 0; index < Math.max(starts.length, ends.length); index++) {
      const rawStart = String(starts[index] ?? '').trim();
      const rawEnd = String(ends[index] ?? '').trim();
      if (rawStart === '' && rawEnd === '') continue;
      const breakStart = parseHHMM(rawStart);
      const breakEnd = parseHHMM(rawEnd);
      if (breakStart === null || breakEnd === null) {
        throw new WorkingHoursValidationError('break');
      }
      breaks.push([breakStart, breakEnd]);
    }
    rows.push({ weekday, startMinute, endMinute, breaks });
  }
  return normalizeWorkingHoursRows(rows);
}
