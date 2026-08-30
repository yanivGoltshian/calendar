import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sendReminder, type ReminderAppointment } from './send';

/**
 * בדיקות ל-sendReminder — גזירת ערוץ התזכורת מתוך העדפת העסק (relation settings)
 * וזהות הלקוח. בדיקות טהורות ללא DB וללא ספקים אמיתיים: שתיהן נכנסות למסלול ה-skip
 * של resolveReminderChannel לפני שנגזרת קריאה לספק, ולכן דטרמיניסטיות בכל סביבה.
 *
 * הן שומרות על התיקון: ערוץ התזכורת נקרא מ-appt.business.settings.reminderChannel
 * (ולא ישירות מ-business), ו-settings nullable → ברירת מחדל AUTO.
 */

function makeAppt(
  settings: { reminderChannel: string } | null,
  client: Omit<ReminderAppointment['client'], 'id'>,
  isExclusive: boolean = true,
): ReminderAppointment {
  return {
    id: 'appt-1',
    startAt: new Date('2026-01-01T10:00:00.000Z'),
    confirmToken: 'tok-1',
    business: {
      id: 'biz-1',
      name: 'עסק לדוגמה',
      timezone: 'Asia/Jerusalem',
      isExclusive,
      settings,
    },
    client: { id: 'client-1', ...client },
  };
}

test('settings=null → ברירת מחדל AUTO: לקוח ללא מייל וללא טלפון מדולג עם הסיבה הנכונה', async () => {
  const res = await sendReminder(
    makeAppt(null, { name: 'לקוח', phone: null, email: null }),
  );
  assert.deepEqual(res, {
    status: 'skipped',
    reason: 'client has neither email nor phone',
  });
});

test('ערוץ מפורש מתוך settings מכובד: EMAIL ללקוח בלי מייל מדולג (לא נופל לטלפון)', async () => {
  const res = await sendReminder(
    makeAppt({ reminderChannel: 'EMAIL' }, {
      name: 'לקוח',
      phone: '+972500000000',
      email: null,
    }),
  );
  assert.deepEqual(res, {
    status: 'skipped',
    reason: 'channel EMAIL requested but client has no email',
  });
});

test('אקסקלוסיב + AUTO + טלפון בלבד → מסרון דרך שער העלות, מוחזר sent', async () => {
  const calls: Array<{ businessId: string; to: string; clientId?: string | null }> = [];
  const res = await sendReminder(
    makeAppt(null, { name: 'לקוח', phone: '+972500000000', email: null }, true),
    {
      sendGuardedSms: async (req) => {
        calls.push({ businessId: req.businessId, to: req.to, clientId: req.clientId });
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
    },
  );
  assert.deepEqual(res, { status: 'sent', channel: 'SMS' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    businessId: 'biz-1',
    to: '+972500000000',
    clientId: 'client-1',
  });
});

test('אקסקלוסיב + מסרון שנחסם בתקרה → skipped (לא כשל, לא ניסיון חוזר)', async () => {
  const res = await sendReminder(
    makeAppt({ reminderChannel: 'SMS' }, {
      name: 'לקוח',
      phone: '+972500000000',
      email: null,
    }, true),
    {
      sendGuardedSms: async () => ({ status: 'blocked', usedAgorot: 4500, capAgorot: 4500 }),
    },
  );
  assert.deepEqual(res, { status: 'skipped', reason: 'monthly SMS cost cap reached' });
});

test('לא-אקסקלוסיב + AUTO + טלפון בלבד → מדולג, שער העלות לא נקרא', async () => {
  let called = false;
  const res = await sendReminder(
    makeAppt(null, { name: 'לקוח', phone: '+972500000000', email: null }, false),
    {
      sendGuardedSms: async () => {
        called = true;
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
    },
  );
  assert.deepEqual(res, {
    status: 'skipped',
    reason: 'client has no email and paid SMS is not enabled on this plan',
  });
  assert.equal(called, false);
});

test('אקסקלוסיב + AUTO + מייל וטלפון → מסרון בלבד, המייל לא נשלח (ברירת מחדל אקסקלוסיב)', async () => {
  const smsCalls: string[] = [];
  const emailCalls: string[] = [];
  const res = await sendReminder(
    makeAppt(null, { name: 'לקוח', phone: '+972500000000', email: 'a@b.com' }, true),
    {
      sendGuardedSms: async (req) => {
        smsCalls.push(req.to);
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
      sendEmail: async (to) => {
        emailCalls.push(to);
      },
      emailConfigured: true,
    },
  );
  assert.deepEqual(res, { status: 'sent', channel: 'SMS' });
  assert.deepEqual(smsCalls, ['+972500000000']);
  assert.equal(emailCalls.length, 0);
});

test('אקסקלוסיב + BOTH + מייל וטלפון → שתי שליחות (מייל ומסרון)', async () => {
  const smsCalls: string[] = [];
  const emailCalls: string[] = [];
  const res = await sendReminder(
    makeAppt({ reminderChannel: 'BOTH' }, {
      name: 'לקוח',
      phone: '+972500000000',
      email: 'a@b.com',
    }, true),
    {
      sendGuardedSms: async (req) => {
        smsCalls.push(req.to);
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
      sendEmail: async (to) => {
        emailCalls.push(to);
      },
      emailConfigured: true,
    },
  );
  assert.deepEqual(res, { status: 'sent', channel: 'EMAIL' });
  assert.deepEqual(emailCalls, ['a@b.com']);
  assert.deepEqual(smsCalls, ['+972500000000']);
});

test('לא-אקסקלוסיב + BOTH + מייל וטלפון → מייל בלבד, המסרון לא נקרא', async () => {
  const smsCalls: string[] = [];
  const emailCalls: string[] = [];
  const res = await sendReminder(
    makeAppt({ reminderChannel: 'BOTH' }, {
      name: 'לקוח',
      phone: '+972500000000',
      email: 'a@b.com',
    }, false),
    {
      sendGuardedSms: async (req) => {
        smsCalls.push(req.to);
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
      sendEmail: async (to) => {
        emailCalls.push(to);
      },
      emailConfigured: true,
    },
  );
  assert.deepEqual(res, { status: 'sent', channel: 'EMAIL' });
  assert.deepEqual(emailCalls, ['a@b.com']);
  assert.equal(smsCalls.length, 0);
});

test('לא-אקסקלוסיב + SMS מפורש + מייל וטלפון → נפילה למייל, המסרון לא נקרא', async () => {
  const smsCalls: string[] = [];
  const emailCalls: string[] = [];
  const res = await sendReminder(
    makeAppt({ reminderChannel: 'SMS' }, {
      name: 'לקוח',
      phone: '+972500000000',
      email: 'a@b.com',
    }, false),
    {
      sendGuardedSms: async (req) => {
        smsCalls.push(req.to);
        return { status: 'sent', costAgorot: 10, crossedAlert: false };
      },
      sendEmail: async (to) => {
        emailCalls.push(to);
      },
      emailConfigured: true,
    },
  );
  assert.deepEqual(res, { status: 'sent', channel: 'EMAIL' });
  assert.deepEqual(emailCalls, ['a@b.com']);
  assert.equal(smsCalls.length, 0);
});
