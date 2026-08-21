import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildApprovalEmail,
  buildApprovalMessage,
  notifyClientOfApproval,
  type ClientApprovalPayload,
} from '@/server/notifications/clientApproval';

const basePayload: ClientApprovalPayload = {
  appointmentId: 'appt-123',
  businessName: 'מספרת הדגמה',
  clientName: 'דנה כהן',
  clientEmail: 'dana@example.com',
  clientPhone: '050-1234567',
  services: [{ name: 'תספורת' }, { name: 'צבע' }],
  startAt: new Date('2026-08-25T09:30:00.000Z'),
  timezone: 'Asia/Jerusalem',
  isPremium: true,
  manageUrl: 'http://localhost:3000/b/demo',
};

test('buildApprovalEmail בונה מייל עברית RTL עם פרטי התור', () => {
  const { subject, text, html } = buildApprovalEmail(basePayload);

  // הנושא כולל את שם העסק ואת בשורת האישור.
  assert.ok(subject.includes('מספרת הדגמה'));
  assert.ok(subject.includes('אושר'));

  // גוף הטקסט כולל את הלקוח, השירותים והקישור לעמוד העסק.
  assert.ok(text.includes('דנה כהן'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('צבע'));
  assert.ok(text.includes('/b/demo'));

  // גוף ה-HTML הוא RTL.
  assert.ok(html.includes('dir="rtl"'));
});

test('buildApprovalMessage בונה הודעת טקסט קצרה עם שם העסק והלקוח', () => {
  const message = buildApprovalMessage(basePayload);
  assert.ok(message.includes('מספרת הדגמה'));
  assert.ok(message.includes('דנה כהן'));
  assert.ok(message.includes('אושר'));
});

test('notifyClientOfApproval שולח מייל והודעה בפרימיום ואינו זורק', async () => {
  const result = await notifyClientOfApproval(basePayload);
  assert.equal(result.emailSkipped, false);
  assert.equal(result.emailed, true);
  // בפיתוח ספק ההודעות הוא console — ההודעה נמסרת דרך WhatsApp ללא שגיאה.
  assert.equal(result.messaged, true);
  assert.equal(result.messageChannel, 'whatsapp');
  assert.deepEqual(result.errors, []);
});

test('notifyClientOfApproval מדלג בחן על מייל כשאין ללקוח כתובת', async () => {
  const result = await notifyClientOfApproval({ ...basePayload, clientEmail: null });
  assert.equal(result.emailSkipped, true);
  assert.equal(result.emailed, false);
  assert.deepEqual(result.errors, []);
});

test('notifyClientOfApproval אינו שולח הודעת טקסט בחבילת בסיס', async () => {
  const result = await notifyClientOfApproval({ ...basePayload, isPremium: false });
  assert.equal(result.messaged, false);
  assert.equal(result.messageChannel, null);
  // מייל עדיין נשלח בבסיס.
  assert.equal(result.emailed, true);
  assert.deepEqual(result.errors, []);
});

test('notifyClientOfApproval אינו שולח הודעה כשאין טלפון גם בפרימיום', async () => {
  const result = await notifyClientOfApproval({ ...basePayload, clientPhone: null });
  assert.equal(result.messaged, false);
  assert.equal(result.messageChannel, null);
  assert.equal(result.emailed, true);
  assert.deepEqual(result.errors, []);
});
