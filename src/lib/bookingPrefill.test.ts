import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCustomerSession, computeEmailFieldVisibility } from './bookingPrefill';

// --- parseCustomerSession: מיפוי תשובת /api/public/customer-session ---

test('לקוח מחובר: ממופה לשם/טלפון/מייל מנורמלים', () => {
  const c = parseCustomerSession({
    customer: { name: 'דנה', phone: '0501234567', email: 'dana@example.com' },
  });
  assert.deepEqual(c, { name: 'דנה', phone: '0501234567', email: 'dana@example.com' });
});

test('אורח (customer=null): מחזיר null', () => {
  assert.equal(parseCustomerSession({ customer: null }), null);
});

test('גוף ריק או לא-אובייקט: מחזיר null', () => {
  assert.equal(parseCustomerSession(null), null);
  assert.equal(parseCustomerSession(undefined), null);
  assert.equal(parseCustomerSession('nope'), null);
  assert.equal(parseCustomerSession({}), null);
});

test('שדות חסרים מומרים למחרוזת ריקה (התנהגות מילוי מראש נשמרת)', () => {
  const c = parseCustomerSession({ customer: { name: 'רון' } });
  assert.deepEqual(c, { name: 'רון', phone: '', email: '' });
});

// --- computeEmailFieldVisibility: נגזרת תצוגת שדה המייל ---

test('מסלול basic: מייל אינו נדרש ואינו מוצג (אורח או מחובר)', () => {
  assert.deepEqual(computeEmailFieldVisibility('basic', null), {
    requireEmail: false,
    hideEmailField: false,
    showEmailField: false,
  });
  assert.deepEqual(
    computeEmailFieldVisibility('basic', { name: 'א', phone: '05', email: 'a@a.co' }),
    { requireEmail: false, hideEmailField: true, showEmailField: false },
  );
});

test('מסלול premium + אורח: מייל נדרש ולכן השדה מוצג', () => {
  assert.deepEqual(computeEmailFieldVisibility('premium', null), {
    requireEmail: true,
    hideEmailField: false,
    showEmailField: true,
  });
});

test('מסלול premium + לקוח מחובר עם מייל: השדה מוסתר (המייל כבר ידוע)', () => {
  assert.deepEqual(
    computeEmailFieldVisibility('premium', { name: 'א', phone: '05', email: 'a@a.co' }),
    { requireEmail: true, hideEmailField: true, showEmailField: false },
  );
});

test('מסלול exclusive + לקוח מחובר ללא מייל: השדה עדיין מוצג', () => {
  assert.deepEqual(
    computeEmailFieldVisibility('exclusive', { name: 'א', phone: '05', email: '' }),
    { requireEmail: true, hideEmailField: false, showEmailField: true },
  );
});
