import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWaitlistEmail,
  resolveOwnerWaitlistTarget,
  notifyOwnerOfWaitlist,
  type OwnerWaitlistPayload,
} from '@/server/notifications/ownerWaitlist';
import { contactEmail } from '@/config/contact';

const basePayload: OwnerWaitlistPayload = {
  entryId: 'wl-123',
  businessName: 'מספרת הדגמה',
  ownerEmail: 'business@example.com',
  ownerUserEmail: 'owner-user@example.com',
  clientName: 'דנה כהן',
  clientPhone: '050-1234567',
  serviceName: 'תספורת',
  desiredDate: '2026-08-25',
  earliestMinute: 540, // 09:00
  latestMinute: 720, // 12:00
  timezone: 'Asia/Jerusalem',
  waitlistUrl: 'http://localhost:3000/admin/waitlist',
};

test('buildWaitlistEmail בונה מייל עברית RTL עם כל פרטי ההצטרפות', () => {
  const { subject, text, html } = buildWaitlistEmail(basePayload);

  // נושא כולל שם העסק.
  assert.ok(subject.includes('מספרת הדגמה'));

  // גוף הטקסט כולל לקוח, טלפון, שירות, יום מבוקש, חלון זמן וקישור לניהול.
  assert.ok(text.includes('דנה כהן'));
  assert.ok(text.includes('050-1234567'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('2026'));
  assert.ok(text.includes('09:00–12:00'));
  assert.ok(text.includes('/admin/waitlist'));

  // גוף ה-HTML הוא RTL ומכיל קישור לניהול רשימת ההמתנה.
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('/admin/waitlist'));
});

test('buildWaitlistEmail מדלג בחן על שדות רשות חסרים', () => {
  const { text } = buildWaitlistEmail({
    ...basePayload,
    clientPhone: null,
    serviceName: null,
    desiredDate: null,
    earliestMinute: null,
    latestMinute: null,
  });
  // אין שורות ריקות מיותרות ואין תוויות של שדות שלא סופקו.
  assert.ok(!text.includes('טלפון:'));
  assert.ok(!text.includes('שירות:'));
  assert.ok(!text.includes('חלון זמן מועדף:'));
  // עדיין כולל את שם הלקוח.
  assert.ok(text.includes('דנה כהן'));
});

test('resolveOwnerWaitlistTarget מעדיף את מייל העסק ולעולם לא את מייל הפלטפורמה', () => {
  // מייל העסק גובר על מייל המשתמש הבעלים.
  assert.equal(
    resolveOwnerWaitlistTarget({ ownerEmail: 'business@example.com', ownerUserEmail: 'owner@example.com' }),
    'business@example.com',
  );

  // נפילה למייל המשתמש הבעלים כשאין מייל עסק.
  assert.equal(
    resolveOwnerWaitlistTarget({ ownerEmail: '  ', ownerUserEmail: 'owner@example.com' }),
    'owner@example.com',
  );

  // כששניהם ריקים — null (דילוג בחן), ולא מייל הפלטפורמה.
  const target = resolveOwnerWaitlistTarget({ ownerEmail: null, ownerUserEmail: undefined });
  assert.equal(target, null);
  assert.notEqual(target, contactEmail());
});

test('notifyOwnerOfWaitlist שולח למייל העסק ואינו זורק', async () => {
  const result = await notifyOwnerOfWaitlist(basePayload);
  assert.notEqual(basePayload.ownerEmail, contactEmail());
  assert.equal(result.skipped, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfWaitlist מדלג בחן כשאין מייל של העסק', async () => {
  const result = await notifyOwnerOfWaitlist({
    ...basePayload,
    ownerEmail: null,
    ownerUserEmail: null,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.emailed, false);
  assert.deepEqual(result.errors, []);
});

test('notifyOwnerOfWaitlist אינו זורק גם ללא טלפון וללא SMTP', async () => {
  await assert.doesNotReject(async () => {
    const result = await notifyOwnerOfWaitlist({ ...basePayload, clientPhone: null });
    assert.equal(typeof result.emailed, 'boolean');
  });
});
