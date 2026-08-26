import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVisitSummaryEmail,
  buildVisitSummaryMessage,
  type VisitSummaryPayload,
} from '@/server/notifications/visitSummary';

const base: VisitSummaryPayload = {
  appointmentId: 'appt_1',
  businessName: 'מספרת הרצל',
  clientName: 'דנה',
  clientEmail: 'dana@example.com',
  clientPhone: '+972501234567',
  services: [{ name: 'תספורת' }],
  rebookUrl: 'https://torchick.duckdns.org/b/herzl?rebook=svc_1&staff=stf_1',
  isPremium: true,
};

test('buildVisitSummaryEmail מנסח נושא עם המותג ושם העסק', () => {
  const { subject } = buildVisitSummaryEmail(base);
  assert.ok(subject.includes('תור צ׳יק'));
  assert.ok(subject.includes('מספרת הרצל'));
  assert.ok(subject.includes('תודה על הביקור'));
});

test('גוף הטקסט מודה ללקוח, מציין את השירות וכולל קישור לתור חוזר', () => {
  const { text } = buildVisitSummaryEmail(base);
  assert.ok(text.includes('שלום דנה'));
  assert.ok(text.includes('תודה שביקרת ב'));
  assert.ok(text.includes('תספורת'));
  assert.ok(text.includes('לקביעת תור חוזר'));
  assert.ok(text.includes(base.rebookUrl));
});

test('גוף ה-HTML הוא RTL ומטמיע כפתור בולט לתור חוזר', () => {
  const { html } = buildVisitSummaryEmail(base);
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes(`href="${base.rebookUrl}"`));
  assert.ok(html.includes('לקביעת תור חוזר'));
});

test('ללא שירותים — עדיין נשמרת הקריאה לפעולה והקישור, בלי שורת הטיפול', () => {
  const { text } = buildVisitSummaryEmail({ ...base, services: [] });
  assert.ok(!text.includes('הטיפול שקיבלת'));
  assert.ok(text.includes('לקביעת תור חוזר'));
  assert.ok(text.includes(base.rebookUrl));
});

test('מספר שירותים מצטרפים לרשימה מופרדת בפסיקים', () => {
  const { text } = buildVisitSummaryEmail({
    ...base,
    services: [{ name: 'תספורת' }, { name: 'החלקה' }],
  });
  assert.ok(text.includes('תספורת, החלקה'));
});

test('buildVisitSummaryMessage — הודעת טקסט קצרה עם שם, עסק, שירות וקישור', () => {
  const msg = buildVisitSummaryMessage(base);
  assert.ok(msg.startsWith('תור צ׳יק:'));
  assert.ok(msg.includes('שלום דנה'));
  assert.ok(msg.includes('מספרת הרצל'));
  assert.ok(msg.includes('תספורת'));
  assert.ok(msg.includes('לקביעת תור חוזר'));
  assert.ok(msg.includes(base.rebookUrl));
});

test('הודעת הטקסט תקינה גם ללא שירותים', () => {
  const msg = buildVisitSummaryMessage({ ...base, services: [] });
  assert.ok(msg.includes('תודה על הביקור ב'));
  assert.ok(msg.includes(base.rebookUrl));
  assert.ok(!msg.includes('()'));
});
