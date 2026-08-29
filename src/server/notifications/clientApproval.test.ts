import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildApprovalEmail,
  buildApprovalMessage,
  notifyClientOfApproval,
  type ClientApprovalPayload,
  type NotifyClientApprovalDeps,
} from '@/server/notifications/clientApproval';

const basePayload: ClientApprovalPayload = {
  appointmentId: 'appt-123',
  businessId: 'biz-1',
  clientId: 'client-1',
  businessName: 'מספרת הדגמה',
  clientName: 'דנה כהן',
  clientEmail: 'dana@example.com',
  clientPhone: '050-1234567',
  services: [{ name: 'תספורת' }, { name: 'צבע' }],
  startAt: new Date('2026-08-25T09:30:00.000Z'),
  timezone: 'Asia/Jerusalem',
  // ברירת מחדל לבדיקות: אקסקלוסיב פעיל (מייל + מסרון בתשלום דרך שער העלות).
  canEmail: true,
  isExclusive: true,
  manageUrl: 'http://localhost:3000/b/demo',
};

/** שער עלות מזויף לבדיקות — אינו נוגע ב-DB, מחזיר מסירה מוצלחת. */
function fakeGuardDeps(): NotifyClientApprovalDeps {
  return {
    sendGuardedSms: async () => ({ status: 'sent', costAgorot: 10, crossedAlert: false }),
  };
}

test('buildApprovalEmail בונה מייל עברית RTL עם פרטי התור', () => {
  const { subject, text, html } = buildApprovalEmail(basePayload);

  assert.ok(subject.includes('מספרת הדגמה'));
  assert.ok(subject.includes('אושר'));

  assert.ok(text.includes('דנה כהן'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('צבע'));
  assert.ok(text.includes('/b/demo'));

  assert.ok(html.includes('dir="rtl"'));
});

test('buildApprovalMessage בונה הודעת טקסט קצרה עם שם העסק והלקוח', () => {
  const message = buildApprovalMessage(basePayload);
  assert.ok(message.includes('מספרת הדגמה'));
  assert.ok(message.includes('דנה כהן'));
  assert.ok(message.includes('אושר'));
});

test('notifyClientOfApproval שולח מייל ומסרון באקסקלוסיב דרך שער העלות ואינו זורק', async () => {
  const result = await notifyClientOfApproval(basePayload, fakeGuardDeps());
  assert.equal(result.emailSkipped, false);
  assert.equal(result.emailed, true);
  // מסרון נמסר דרך שער העלות המזויף ללא שגיאה.
  assert.equal(result.messaged, true);
  assert.equal(result.messageChannel, 'sms');
  assert.deepEqual(result.errors, []);
});

test('notifyClientOfApproval מדלג בחן על מייל כשאין ללקוח כתובת', async () => {
  const result = await notifyClientOfApproval(
    { ...basePayload, clientEmail: null },
    fakeGuardDeps(),
  );
  assert.equal(result.emailSkipped, true);
  assert.equal(result.emailed, false);
  assert.deepEqual(result.errors, []);
});

test('סטנדרט: אין ערוצי תקשורת ללקוח — לא מייל ולא מסרון', async () => {
  const result = await notifyClientOfApproval(
    { ...basePayload, canEmail: false, isExclusive: false },
    fakeGuardDeps(),
  );
  assert.equal(result.emailed, false);
  assert.equal(result.emailSkipped, true);
  assert.equal(result.messaged, false);
  assert.equal(result.messageChannel, null);
  assert.deepEqual(result.errors, []);
});

test('פרימיום: שולח מייל אך לא מסרון (ערוץ המסרון רק באקסקלוסיב)', async () => {
  const result = await notifyClientOfApproval(
    { ...basePayload, isExclusive: false },
    fakeGuardDeps(),
  );
  assert.equal(result.emailed, true);
  assert.equal(result.messaged, false);
  assert.equal(result.messageChannel, null);
  assert.deepEqual(result.errors, []);
});

test('אקסקלוסיב ללא טלפון: לא נשלח מסרון, המייל עדיין נשלח', async () => {
  const result = await notifyClientOfApproval(
    { ...basePayload, clientPhone: null },
    fakeGuardDeps(),
  );
  assert.equal(result.messaged, false);
  assert.equal(result.messageChannel, null);
  assert.equal(result.emailed, true);
  assert.deepEqual(result.errors, []);
});
