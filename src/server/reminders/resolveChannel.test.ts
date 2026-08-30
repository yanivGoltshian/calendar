import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveReminderChannel, resolveReminderTargets } from './resolveChannel';

/**
 * בדיקות ל-resolveReminderChannel ו-resolveReminderTargets — גזירת ערוצי התזכורת
 * ויעדי השליחה מתוך זהות הלקוח והעדפת העסק. בדיקות טהורות ללא DB (node:test +
 * assert/strict), בסגנון שאר בדיקות היחידה במאגר. מכסות: מצב אוטומטי תלוי-תוכנית
 * (אקסקלוסיב מעדיף מסרון, שאר החבילות מייל), עקיפות ידניות (EMAIL/SMS/BOTH) כולל
 * דילוג כשאין יעד תואם, שליחה כפולה ב-BOTH, ומחרוזות ריקות/רווחים.
 */

test('AUTO: עסק אקסקלוסיב עם מייל וטלפון — נשלח במסרון (ברירת מחדל אקסקלוסיב)', () => {
  const r = resolveReminderChannel(
    { email: 'a@b.com', phone: '0501234567' },
    'AUTO',
  );
  assert.deepEqual(r, { kind: 'send', channel: 'SMS', to: '0501234567' });
});

test('AUTO: לקוח עם מייל בלבד וללא טלפון — נשלח במייל (מסלול מייל בלבד)', () => {
  const r = resolveReminderChannel({ email: 'only@mail.co', phone: null }, 'AUTO');
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'only@mail.co' });
});

test('AUTO: לקוח עם טלפון בלבד — נשלח במסרון', () => {
  const r = resolveReminderChannel({ email: null, phone: '0501234567' }, 'AUTO');
  assert.deepEqual(r, { kind: 'send', channel: 'SMS', to: '0501234567' });
});

test('AUTO: לקוח ללא מייל וללא טלפון — דילוג עם סיבה', () => {
  const r = resolveReminderChannel({ email: null, phone: null }, 'AUTO');
  assert.equal(r.kind, 'skip');
});

test('AUTO: מחרוזות ריקות/רווחים נחשבות כחסרות — דילוג', () => {
  const r = resolveReminderChannel({ email: '   ', phone: '' }, 'AUTO');
  assert.equal(r.kind, 'skip');
});

test('EMAIL מפורש: יש מייל — נשלח במייל', () => {
  const r = resolveReminderChannel(
    { email: 'x@y.com', phone: '0501234567' },
    'EMAIL',
  );
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'x@y.com' });
});

test('EMAIL מפורש: אין מייל אך יש טלפון — דילוג (לא נופל לטלפון)', () => {
  const r = resolveReminderChannel({ email: null, phone: '0501234567' }, 'EMAIL');
  assert.equal(r.kind, 'skip');
});

test('SMS מפורש: יש טלפון — נשלח במסרון', () => {
  const r = resolveReminderChannel(
    { email: 'x@y.com', phone: '0501234567' },
    'SMS',
  );
  assert.deepEqual(r, { kind: 'send', channel: 'SMS', to: '0501234567' });
});

test('SMS מפורש: אין טלפון אך יש מייל — דילוג (לא נופל למייל)', () => {
  const r = resolveReminderChannel({ email: 'x@y.com', phone: null }, 'SMS');
  assert.equal(r.kind, 'skip');
});

test('ערך לא מוכר (למשל PUSH) מתנהג כמו אוטומטי — נגזר מזהות הלקוח', () => {
  const r = resolveReminderChannel({ email: 'p@q.com', phone: null }, 'PUSH');
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'p@q.com' });
});

/**
 * שער החבילה (allowSms=false) — פרימיום/בסיס אינם דלוקים למסרון בתשלום ללקוח.
 * הבדיקות מוודאות שלעולם לא נגזר SMS: יש עדיפות למייל, ואם אין מייל מדלגים בבטחה
 * ולא נופלים למסרון, בכל אחד ממצבי ההעדפה (AUTO ו-SMS מפורש).
 */

test('allowSms=false, AUTO: לקוח עם מייל וטלפון — נשלח במייל (לא במסרון)', () => {
  const r = resolveReminderChannel(
    { email: 'a@b.com', phone: '0501234567' },
    'AUTO',
    false,
  );
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'a@b.com' });
});

test('allowSms=false, AUTO: לקוח עם טלפון בלבד — דילוג (לא נופל למסרון)', () => {
  const r = resolveReminderChannel({ email: null, phone: '0501234567' }, 'AUTO', false);
  assert.deepEqual(r, {
    kind: 'skip',
    reason: 'client has no email and paid SMS is not enabled on this plan',
  });
});

test('allowSms=false, SMS מפורש: יש מייל — נפילה למייל', () => {
  const r = resolveReminderChannel(
    { email: 'x@y.com', phone: '0501234567' },
    'SMS',
    false,
  );
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'x@y.com' });
});

test('allowSms=false, SMS מפורש: אין מייל אך יש טלפון — דילוג (לא נשלח מסרון)', () => {
  const r = resolveReminderChannel({ email: null, phone: '0501234567' }, 'SMS', false);
  assert.deepEqual(r, {
    kind: 'skip',
    reason: 'channel SMS requested but paid SMS is not enabled on this plan',
  });
});

/**
 * resolveReminderTargets — הפונקציה הקנונית שמחזירה 0/1/2 יעדים. משמשת את שליחה
 * הכפולה של BOTH ואת ברירת המחדל התלוית-תוכנית.
 */

test('targets BOTH אקסקלוסיב עם מייל וטלפון — שני יעדים (מייל ומסרון)', () => {
  const r = resolveReminderTargets(
    { email: 'a@b.com', phone: '0501234567' },
    'BOTH',
    true,
  );
  assert.deepEqual(r, [
    { channel: 'EMAIL', to: 'a@b.com' },
    { channel: 'SMS', to: '0501234567' },
  ]);
});

test('targets BOTH לא-אקסקלוסיב עם מייל וטלפון — מייל בלבד (הורדה לתוכנית)', () => {
  const r = resolveReminderTargets(
    { email: 'a@b.com', phone: '0501234567' },
    'BOTH',
    false,
  );
  assert.deepEqual(r, [{ channel: 'EMAIL', to: 'a@b.com' }]);
});

test('targets BOTH אקסקלוסיב עם טלפון בלבד — מסרון בלבד', () => {
  const r = resolveReminderTargets({ email: null, phone: '0501234567' }, 'BOTH', true);
  assert.deepEqual(r, [{ channel: 'SMS', to: '0501234567' }]);
});

test('targets BOTH אקסקלוסיב ללא מייל וללא טלפון — ללא יעדים', () => {
  const r = resolveReminderTargets({ email: null, phone: null }, 'BOTH', true);
  assert.deepEqual(r, []);
});

test('targets AUTO אקסקלוסיב עם מייל וטלפון — מסרון בלבד (ברירת מחדל אקסקלוסיב)', () => {
  const r = resolveReminderTargets(
    { email: 'a@b.com', phone: '0501234567' },
    'AUTO',
    true,
  );
  assert.deepEqual(r, [{ channel: 'SMS', to: '0501234567' }]);
});

test('targets AUTO לא-אקסקלוסיב עם מייל וטלפון — מייל בלבד', () => {
  const r = resolveReminderTargets(
    { email: 'a@b.com', phone: '0501234567' },
    'AUTO',
    false,
  );
  assert.deepEqual(r, [{ channel: 'EMAIL', to: 'a@b.com' }]);
});
