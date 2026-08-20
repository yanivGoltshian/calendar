import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_METRICS,
  formatDaysLeft,
  formatShekelFromAgorot,
  formatShekelOrDash,
  isSlugConfirmed,
  metricsFor,
  parseEditBusinessInput,
  shapeBusinessMetrics,
} from './logic';

test('shapeBusinessMetrics ממזג מספר מקורות אגרגציה למפה אחת לפי מזהה עסק', () => {
  const map = shapeBusinessMetrics({
    clientCounts: [
      { businessId: 'a', count: 5 },
      { businessId: 'b', count: 2 },
    ],
    appointmentCounts: [{ businessId: 'a', count: 10 }],
    appointmentValues: [{ businessId: 'a', sumAgorot: 120000 }],
    cashReceipts: [{ businessId: 'b', sumAgorot: 5000 }],
  });
  assert.deepEqual(map.get('a'), {
    clients: 5,
    appointments: 10,
    appointmentsValueAgorot: 120000,
    cashReceiptsAgorot: 0,
  });
  assert.deepEqual(map.get('b'), {
    clients: 2,
    appointments: 0,
    appointmentsValueAgorot: 0,
    cashReceiptsAgorot: 5000,
  });
});

test('metricsFor מחזיר מטריקות ריקות לעסק שאינו במפה', () => {
  const map = shapeBusinessMetrics({
    clientCounts: [],
    appointmentCounts: [],
    appointmentValues: [],
    cashReceipts: [],
  });
  assert.deepEqual(metricsFor(map, 'missing'), EMPTY_METRICS);
});

test('formatShekelFromAgorot ממיר אגורות לשקלים ומטפל ב-null כאפס', () => {
  assert.equal(formatShekelFromAgorot(12345), '₪123.45');
  assert.equal(formatShekelFromAgorot(0), '₪0');
  assert.equal(formatShekelFromAgorot(null), '₪0');
  assert.equal(formatShekelFromAgorot(undefined), '₪0');
});

test('formatShekelOrDash מציג מקף כשאין ערך ומחיר כשיש', () => {
  assert.equal(formatShekelOrDash(null), '—');
  assert.equal(formatShekelOrDash(undefined), '—');
  assert.equal(formatShekelOrDash(9900), '₪99');
});

test('formatDaysLeft מקרקע לאפס ומטפל בלא-פעיל', () => {
  assert.equal(formatDaysLeft(true, 5), '5');
  assert.equal(formatDaysLeft(true, -3), '0');
  assert.equal(formatDaysLeft(false, 12), '0');
  assert.equal(formatDaysLeft(true, 4.6), '5');
});

test('isSlugConfirmed דורש התאמה מדויקת ו-slug לא ריק', () => {
  assert.equal(isSlugConfirmed('my-shop', 'my-shop'), true);
  assert.equal(isSlugConfirmed('  my-shop  ', 'my-shop'), true);
  assert.equal(isSlugConfirmed('my-shop', 'other-shop'), false);
  assert.equal(isSlugConfirmed('', ''), false);
  assert.equal(isSlugConfirmed('   ', ''), false);
});

test('parseEditBusinessInput מנקה קלט ומחזיר null לשדות ריקים', () => {
  const result = parseEditBusinessInput({
    name: '  מספרה  ',
    phone: ' 050-1234567 ',
    ownerEmail: '  owner@example.com ',
    planNotes: '   ',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      name: 'מספרה',
      phone: '050-1234567',
      ownerEmail: 'owner@example.com',
      planNotes: null,
    });
  }
});

test('parseEditBusinessInput דוחה שם ריק', () => {
  const result = parseEditBusinessInput({ name: '   ', phone: '', ownerEmail: '', planNotes: '' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'name');
});

test('parseEditBusinessInput דוחה מייל לא תקין אך מתיר מייל ריק', () => {
  const bad = parseEditBusinessInput({
    name: 'עסק',
    phone: '',
    ownerEmail: 'not-an-email',
    planNotes: '',
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, 'email');

  const emptyEmail = parseEditBusinessInput({
    name: 'עסק',
    phone: '',
    ownerEmail: '',
    planNotes: '',
  });
  assert.equal(emptyEmail.ok, true);
  if (emptyEmail.ok) assert.equal(emptyEmail.data.ownerEmail, null);
});
