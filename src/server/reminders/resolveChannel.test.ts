import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveReminderChannel } from './resolveChannel';

/**
 * בדיקות ל-resolveReminderChannel — גזירת ערוץ התזכורת ויעד השליחה מתוך זהות הלקוח
 * והעדפת העסק. בדיקות טהורות ללא DB (node:test + assert/strict), בסגנון שאר בדיקות
 * היחידה במאגר. מכסות: מצב אוטומטי (עדיפות למייל, נפילה לטלפון, דילוג ללא יעד),
 * עקיפות ידניות (EMAIL/SMS) כולל דילוג כשאין יעד תואם, ומחרוזות ריקות/רווחים.
 */

test('AUTO: לקוח עם מייל וטלפון — נשלח במייל (עדיפות למייל)', () => {
  const r = resolveReminderChannel(
    { email: 'a@b.com', phone: '0501234567' },
    'AUTO',
  );
  assert.deepEqual(r, { kind: 'send', channel: 'EMAIL', to: 'a@b.com' });
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
