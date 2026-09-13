export type BreakInterval = [startMinute: number, endMinute: number];

export type WorkingHoursRow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breaks: BreakInterval[];
};

export type WorkingHoursErrorCode = 'range' | 'break' | 'break_overlap';

export class WorkingHoursValidationError extends Error {
  constructor(public readonly code: WorkingHoursErrorCode) {
    super(code);
    this.name = 'WorkingHoursValidationError';
  }
}

function validMinute(value: unknown, allowEndOfDay = false): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= (allowEndOfDay ? 1440 : 1439);
}

export function normalizeBreakIntervals(
  value: unknown,
  startMinute: number,
  endMinute: number,
): BreakInterval[] {
  if (!Array.isArray(value)) throw new WorkingHoursValidationError('break');
  const breaks = value.map((pair): BreakInterval => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new WorkingHoursValidationError('break');
    }
    const [start, end] = pair;
    if (
      !validMinute(start) ||
      !validMinute(end, true) ||
      end <= start ||
      start < startMinute ||
      end > endMinute
    ) {
      throw new WorkingHoursValidationError('break');
    }
    return [start, end];
  });
  breaks.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  for (let index = 1; index < breaks.length; index++) {
    if (breaks[index][0] < breaks[index - 1][1]) {
      throw new WorkingHoursValidationError('break_overlap');
    }
  }
  return breaks;
}

export function normalizeWorkingHoursRows(rows: readonly WorkingHoursRow[]): WorkingHoursRow[] {
  const normalized = rows.map((row) => {
    if (
      !Number.isInteger(row.weekday) ||
      row.weekday < 0 ||
      row.weekday > 6 ||
      !validMinute(row.startMinute) ||
      !validMinute(row.endMinute, true) ||
      row.endMinute <= row.startMinute
    ) {
      throw new WorkingHoursValidationError('range');
    }
    return {
      weekday: row.weekday,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      breaks: normalizeBreakIntervals(row.breaks, row.startMinute, row.endMinute),
    };
  });
  return normalized.sort(
    (left, right) =>
      left.weekday - right.weekday ||
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute,
  );
}

export function normalizeStoredWorkingHours<
  T extends { weekday: number; startMinute: number; endMinute: number; breaks: unknown },
>(rows: readonly T[]): Array<Omit<T, 'breaks'> & { breaks: BreakInterval[] }> {
  return rows
    .map((row) => ({
      ...row,
      breaks: normalizeBreakIntervals(row.breaks, row.startMinute, row.endMinute),
    }))
    .sort(
      (left, right) =>
        left.weekday - right.weekday ||
        left.startMinute - right.startMinute ||
        left.endMinute - right.endMinute,
    );
}
