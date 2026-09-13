import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWorkingHoursForm } from './workingHoursForm';
import { WorkingHoursValidationError } from './workingHours';

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

test('working-hours form accepts zero, one and many sorted or adjacent breaks', () => {
  assert.deepEqual(parseWorkingHoursForm(form({
    open_0: 'on', start_0: '09:00', end_0: '17:00',
    breakStart_0: '', breakEnd_0: '',
  })), [{ weekday: 0, startMinute: 540, endMinute: 1020, breaks: [] }]);

  assert.deepEqual(parseWorkingHoursForm(form({
    open_1: 'on', start_1: '09:00', end_1: '17:00',
    breakStart_1: '12:00', breakEnd_1: '13:00',
  }))[0].breaks, [[720, 780]]);

  assert.deepEqual(parseWorkingHoursForm(form({
    open_2: 'on', start_2: '09:00', end_2: '18:00',
    breakStart_2: ['15:00', '12:30', '12:00'],
    breakEnd_2: ['15:15', '13:00', '12:30'],
  }))[0].breaks, [[720, 750], [750, 780], [900, 915]]);

  assert.deepEqual(parseWorkingHoursForm(form({
    open_3: 'on', start_3: '18:00', end_3: '24:00',
    breakStart_3: '23:00', breakEnd_3: '24:00',
  })), [{
    weekday: 3,
    startMinute: 1080,
    endMinute: 1440,
    breaks: [[1380, 1440]],
  }]);
});

test('working-hours form rejects incomplete, reversed, out-of-hours and overlapping breaks', () => {
  const cases: Array<[Record<string, string | string[]>, string]> = [
    [{ breakStart_0: '12:00', breakEnd_0: '' }, 'break'],
    [{ breakStart_0: '13:00', breakEnd_0: '12:00' }, 'break'],
    [{ breakStart_0: '08:30', breakEnd_0: '09:30' }, 'break'],
    [{ breakStart_0: ['12:00', '12:30'], breakEnd_0: ['13:00', '13:30'] }, 'break_overlap'],
    [{ breakStart_0: ['12:00', '12:00'], breakEnd_0: ['13:00', '13:00'] }, 'break_overlap'],
  ];
  for (const [breaks, code] of cases) {
    assert.throws(
      () => parseWorkingHoursForm(form({
        open_0: 'on', start_0: '09:00', end_0: '17:00', ...breaks,
      })),
      (error) => error instanceof WorkingHoursValidationError && error.code === code,
    );
  }
});
