import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BusinessType } from '@prisma/client';

import { parseCreateBusinessInput } from './parseInput';

/** בונה adapter של get מעל אובייקט פשוט (מדמה FormData.get שמחזיר string|null). */
function getter(fields: Record<string, string>) {
  return (key: string): string | null => (key in fields ? fields[key]! : null);
}

const A_VALID_TYPE = Object.values(BusinessType)[0] as string;

test('מייל בלבד: עסק ללא טלפון נוצר בהצלחה עם phone=null (מסלול מייל בלבד)', () => {
  const result = parseCreateBusinessInput(getter({ name: 'מספרת דנה' }));
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.phone === null);
  assert.ok(result.ok && result.value.name === 'מספרת דנה');
});

test('שם חסר או רווחים בלבד: error=name', () => {
  assert.deepEqual(parseCreateBusinessInput(getter({})), { ok: false, error: 'name' });
  assert.deepEqual(parseCreateBusinessInput(getter({ name: '   ' })), { ok: false, error: 'name' });
});

test('סוג לא-חוקי: error=type', () => {
  assert.deepEqual(parseCreateBusinessInput(getter({ name: 'עסק', type: 'not-a-type' })), {
    ok: false,
    error: 'type',
  });
});

test('סוג חוקי מתקבל ונשמר', () => {
  const result = parseCreateBusinessInput(getter({ name: 'עסק', type: A_VALID_TYPE }));
  assert.ok(result.ok && result.value.type === A_VALID_TYPE);
});

test('סוג ריק מותר (אופציונלי) ומתפרש כ-null', () => {
  const result = parseCreateBusinessInput(getter({ name: 'עסק', type: '' }));
  assert.ok(result.ok && result.value.type === null);
});

test('טלפון וכתובת נשמרים כשסופקו; ריק → null', () => {
  const withValues = parseCreateBusinessInput(
    getter({ name: 'עסק', phone: '050-1234567', address: 'הרצל 1' }),
  );
  assert.ok(withValues.ok && withValues.value.phone === '050-1234567');
  assert.ok(withValues.ok && withValues.value.address === 'הרצל 1');

  const empty = parseCreateBusinessInput(getter({ name: 'עסק', phone: '  ', address: '' }));
  assert.ok(empty.ok && empty.value.phone === null && empty.value.address === null);
});

test('מפתחות שיווק ברשימה נשמרים; מחוץ לרשימה מנוקים ל-null', () => {
  const known = parseCreateBusinessInput(
    getter({ name: 'עסק', priorCalendar: 'google', referralSource: 'instagram' }),
  );
  assert.ok(known.ok && known.value.priorCalendar === 'google');
  assert.ok(known.ok && known.value.referralSource === 'instagram');

  const unknown = parseCreateBusinessInput(
    getter({ name: 'עסק', priorCalendar: 'wat', referralSource: 'zzz' }),
  );
  assert.ok(unknown.ok && unknown.value.priorCalendar === null);
  assert.ok(unknown.ok && unknown.value.referralSource === null);
});
