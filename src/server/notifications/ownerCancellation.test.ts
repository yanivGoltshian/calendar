import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCancellationEmail,
  resolveOwnerCancellationTarget,
  notifyOwnerOfCancellation,
  type OwnerCancellationPayload,
} from '@/server/notifications/ownerCancellation';
import { contactEmail } from '@/config/contact';

const basePayload: OwnerCancellationPayload = {
  appointmentId: 'appt-123',
  businessName: 'מספרת הדגמה',
  ownerEmail: 'business@example.com',
  ownerUserEmail: 'owner-user@example.com',
  clientName: 'דנה כהן',
  clientPhone: '050-1234567',
  services: [{ name: 'תספורת' }, { name: 'צבע' }],
  startAt: new Date('2026-08-25T09:30:00.000Z'),
  timezone: 'Asia/Jerusalem',
  manageUrl: 'http://localhost:3000/admin/appointments',
};

test('buildCancellationEmail בונה מייל עברית RTL עם פרטי הביטול', () => {
  const { subject, text, html } = buildCancellationEmail(basePayload);

  // נושא מציין ביטול וכולל שם העסק.
  assert.ok(subject.includes('בוטל'));
  assert.ok(subject.includes('מספרת הדגמה'));

  // גוף הטקסט כולל לקוח, טלפון, שירותים וקישור ליומן.
  assert.ok(text.includes('דנה כהן'));
  assert.ok(text.includes('050-1234567'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('צבע'));
  assert.ok(text.includes('/admin/appointments'));

  // גוף ה-HTML הוא RTL ומכיל קישור ליומן.
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('/admin/appointments'));
});

test('resolveOwnerCancellationTarget מעדיף את מייל העסק ולעולם לא את מייל הפלטפורמה', () => {
  // מייל העסק גובר על מייל המשתמש הבעלים.
  assert.equal(
    resolveOwnerCancellationTarget({ ownerEmail: 'business@example.com', ownerUserEmail: 'owner@example.com' }),
    'business@example.com',
  );

  // נפילה למייל המשתמש הבעלים כשאין מייל עסק.
  assert.equal(
    resolveOwnerCancellationTarget({ ownerEmail: '  ', ownerUserEmail: 'owner@example.com' }),
    'owner@example.com',
  );

  // כששניהם ריקים — null (דילוג בחן), ולא מייל הפלטפורמה.
  const target = resolveOwnerCancellationTarget({ ownerEmail: null, ownerUserEmail: undefined });
  assert.equal(target, null);
  assert.notEqual(target, contactEmail());
});

test('notifyOwnerOfCancellation שולח למייל העסק ולא למייל הפלטפורמה', async () => {
  const result = await notifyOwnerOfCancellation(basePayload);
  // מייל העסק אינו מייל הפלטפורמה.
  assert.notEqual(basePayload.ownerEmail, contactEmail());
  // לא דילגנו (יש יעד), ולא היו שגיאות בנפילת ה-console.
  assert.equal(result.skipped, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfCancellation אינו זורק ומדלג בחן כשאין מייל של העסק', async () => {
  const result = await notifyOwnerOfCancellation({
    ...basePayload,
    ownerEmail: null,
    ownerUserEmail: null,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.emailed, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfCancellation אינו זורק גם ללא טלפון וללא שירותים', async () => {
  await assert.doesNotReject(async () => {
    const result = await notifyOwnerOfCancellation({ ...basePayload, clientPhone: null, services: [] });
    assert.equal(typeof result.emailed, 'boolean');
  });
});
