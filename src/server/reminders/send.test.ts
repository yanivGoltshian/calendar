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
  client: ReminderAppointment['client'],
): ReminderAppointment {
  return {
    id: 'appt-1',
    startAt: new Date('2026-01-01T10:00:00.000Z'),
    confirmToken: 'tok-1',
    business: { name: 'עסק לדוגמה', timezone: 'Asia/Jerusalem', settings },
    client,
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
