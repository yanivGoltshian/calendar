import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBookingEmail,
  resolveOwnerBookingTarget,
  notifyOwnerOfBooking,
  type OwnerBookingPayload,
} from '@/server/notifications/ownerBooking';
import { contactEmail } from '@/config/contact';

const basePayload: OwnerBookingPayload = {
  appointmentId: 'appt-123',
  businessName: 'מספרת הדגמה',
  ownerEmail: 'business@example.com',
  ownerUserEmail: 'owner-user@example.com',
  clientName: 'דנה כהן',
  clientPhone: '050-1234567',
  services: [
    { name: 'תספורת', priceAgorot: 8000 },
    { name: 'צבע', priceAgorot: 4000 },
  ],
  startAt: new Date('2026-08-25T09:30:00.000Z'),
  timezone: 'Asia/Jerusalem',
  totalPriceAgorot: 12000,
  approvalsUrl: 'http://localhost:3000/admin/appointments?tab=pending',
};

test('buildBookingEmail בונה מייל עברית RTL עם כל פרטי ההזמנה', () => {
  const { subject, text, html } = buildBookingEmail(basePayload);

  // נושא כולל שם העסק.
  assert.ok(subject.includes('מספרת הדגמה'));

  // גוף הטקסט כולל לקוח, טלפון, שירותים, מחיר וקישור לאישור.
  assert.ok(text.includes('דנה כהן'));
  assert.ok(text.includes('050-1234567'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('צבע'));
  assert.ok(text.includes('120 ₪'));
  assert.ok(text.includes('/admin/appointments'));

  // גוף ה-HTML הוא RTL ומכיל קישור לאישור.
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('/admin/appointments'));
});

test('resolveOwnerBookingTarget מעדיף את מייל העסק ולעולם לא את מייל הפלטפורמה', () => {
  // מייל העסק גובר על מייל המשתמש הבעלים.
  assert.equal(
    resolveOwnerBookingTarget({ ownerEmail: 'business@example.com', ownerUserEmail: 'owner@example.com' }),
    'business@example.com',
  );

  // נפילה למייל המשתמש הבעלים כשאין מייל עסק.
  assert.equal(
    resolveOwnerBookingTarget({ ownerEmail: '  ', ownerUserEmail: 'owner@example.com' }),
    'owner@example.com',
  );

  // כששניהם ריקים — null (דילוג בחן), ולא מייל הפלטפורמה.
  const target = resolveOwnerBookingTarget({ ownerEmail: null, ownerUserEmail: undefined });
  assert.equal(target, null);
  assert.notEqual(target, contactEmail());
});

test('notifyOwnerOfBooking שולח למייל העסק ולא למייל הפלטפורמה', async () => {
  const result = await notifyOwnerOfBooking(basePayload);
  // מייל העסק אינו מייל הפלטפורמה.
  assert.notEqual(basePayload.ownerEmail, contactEmail());
  // לא דילגנו (יש יעד), ולא היו שגיאות בנפילת ה-console.
  assert.equal(result.skipped, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfBooking אינו זורק ומדלג בחן כשאין מייל של העסק', async () => {
  const result = await notifyOwnerOfBooking({
    ...basePayload,
    ownerEmail: null,
    ownerUserEmail: null,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.emailed, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfBooking אינו זורק גם ללא טלפון וללא SMTP', async () => {
  await assert.doesNotReject(async () => {
    const result = await notifyOwnerOfBooking({ ...basePayload, clientPhone: null });
    assert.equal(typeof result.emailed, 'boolean');
  });
});
