import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShortDate } from '@/lib/time';

/**
 * נעילה 4 (באג 6): פורמט התאריך בסטטיסטיקות הוא ישראלי he-IL dd/MM/yyyy,
 * ולא אמריקאי MM/DD/YYYY. נועל את הטקסט המרונדר (הפלט של formatShortDate),
 * שהוא התיקון האמיתי — לא הווידג'ט הנייטיב של input type=date.
 */

test('date: formatShortDate מחזיר dd/MM/yyyy (he-IL)', () => {
  // 2025-08-12 → יום 12, חודש 08 → "12.08.2025" או "12/08/2025" בהתאם ל-ICU
  const out = formatShortDate('2025-08-12');
  const digits = out.replace(/\D/g, '');
  assert.equal(digits, '12082025', `ציפייה ל-12/08/2025, התקבל: ${out}`);
});

test('date: היום קודם לחודש (לא פורמט אמריקאי)', () => {
  // 2025-03-04: אם היה אמריקאי היה מציג 03/04; ישראלי מציג 04/03
  const out = formatShortDate('2025-03-04');
  const digits = out.replace(/\D/g, '');
  assert.equal(digits.slice(0, 2), '04', 'היום (04) חייב להופיע ראשון');
  assert.equal(digits.slice(2, 4), '03', 'החודש (03) חייב להופיע שני');
});

test('date: מרפד אפסים מובילים ליום ולחודש חד-ספרתיים', () => {
  const out = formatShortDate('2025-01-05');
  const digits = out.replace(/\D/g, '');
  assert.equal(digits, '05012025');
});
