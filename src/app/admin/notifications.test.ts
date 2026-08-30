import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminNotifications, RENEWAL_REMINDER_DAYS } from './notifications';

test('אין תורים ממתינים ופרימיום רחוק מסוף — אין התראות', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 0);
});

test('תור אחד ממתין — התראת אישור אחת עם קישור לטאב הממתינים', () => {
  const items = buildAdminNotifications({
    pendingCount: 1,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'approval');
  assert.equal(items[0].href, '/admin/appointments?tab=pending');
  assert.ok(items[0].title.includes('אחד'));
});

test('כמה תורים ממתינים — הכותרת כוללת את המספר', () => {
  const items = buildAdminNotifications({
    pendingCount: 4,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.ok(items[0].title.includes('4'));
});

test('בתקופת ניסיון — התראת חידוש מוצגת תמיד וקישור לשדרוג', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'trialing', daysLeft: 25 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'renewal');
  assert.equal(items[0].href, '/admin/upgrade');
  assert.ok(items[0].title.includes('25'));
});

test('פרימיום פעיל — התראת חידוש רק כשקרוב הסוף (סף הימים)', () => {
  const near = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'active', daysLeft: RENEWAL_REMINDER_DAYS },
  });
  assert.equal(near.length, 1);
  assert.equal(near[0].kind, 'renewal');

  const far = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'active', daysLeft: RENEWAL_REMINDER_DAYS + 1 },
  });
  assert.equal(far.length, 0);
});

test('היום/מחר — ניסוח מיוחד לימים 0 ו-1', () => {
  const today = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'trialing', daysLeft: 0 },
  });
  assert.ok(today[0].title.includes('היום'));

  const tomorrow = buildAdminNotifications({
    pendingCount: 0,
    access: { state: 'active', daysLeft: 1 },
  });
  assert.ok(tomorrow[0].title.includes('מחר'));
});

test('שילוב — גם אישור וגם חידוש מופיעים יחד', () => {
  const items = buildAdminNotifications({
    pendingCount: 2,
    access: { state: 'trialing', daysLeft: 3 },
  });
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((i) => i.kind),
    ['approval', 'renewal'],
  );
});

test('ביטול לקוח אחד — התראת ביטול עם קישור להזמנות', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    recentCancellations: 1,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'cancellation');
  assert.equal(items[0].href, '/admin/appointments');
});

test('כמה ביטולי לקוח — הכותרת כוללת את המספר', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    recentCancellations: 3,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'cancellation');
  assert.ok(items[0].title.includes('3'));
});

test('שילוב מלא — אישור, ביטול וחידוש לפי הסדר', () => {
  const items = buildAdminNotifications({
    pendingCount: 2,
    recentCancellations: 1,
    access: { state: 'trialing', daysLeft: 3 },
  });
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => i.kind),
    ['approval', 'cancellation', 'renewal'],
  );
});

test('הזמנה מאושרת אחת — התראת הזמנה עם קישור להזמנות', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    recentBookings: 1,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'booking');
  assert.equal(items[0].href, '/admin/appointments');
  assert.ok(items[0].title.includes('אחת') || items[0].title.length > 0);
});

test('כמה הזמנות מאושרות — הכותרת כוללת את המספר', () => {
  const items = buildAdminNotifications({
    pendingCount: 0,
    recentBookings: 5,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'booking');
  assert.ok(items[0].title.includes('5'));
});

test('הזמנה מאושרת אינה משפיעה על מונה הממתינים — שתי התראות נפרדות', () => {
  const items = buildAdminNotifications({
    pendingCount: 2,
    recentBookings: 3,
    access: { state: 'active', daysLeft: 30 },
  });
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((i) => i.kind),
    ['approval', 'booking'],
  );
});

test('סדר מלא — אישור, הזמנה, ביטול וחידוש', () => {
  const items = buildAdminNotifications({
    pendingCount: 1,
    recentBookings: 1,
    recentCancellations: 1,
    access: { state: 'trialing', daysLeft: 3 },
  });
  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((i) => i.kind),
    ['approval', 'booking', 'cancellation', 'renewal'],
  );
});
