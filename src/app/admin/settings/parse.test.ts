import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfile,
  parsePolicy,
  parseTransparency,
  parseTexts,
  parseReminders,
} from './parse';

/** בונה FormData מאובייקט פשוט. */
function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

test('parseProfile: ממפה שדות, ריק ⇐ null, וברירת מחדל אזור זמן', () => {
  const res = parseProfile(
    form({
      name: '  מספרת הדני  ',
      type: 'BARBERSHOP',
      phone: '050-1234567',
      address: '',
      logoUrl: 'data:image/png;base64,AAAA',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.name, 'מספרת הדני');
  assert.equal(res.data.type, 'BARBERSHOP');
  assert.equal(res.data.phone, '050-1234567');
  assert.equal(res.data.address, null);
  assert.equal(res.data.logoUrl, 'data:image/png;base64,AAAA');
  assert.equal(res.data.coverImageUrl, null);
  assert.equal(res.data.timezone, 'Asia/Jerusalem');
});

test('parseProfile: שם חסר ⇐ שגיאת name', () => {
  const res = parseProfile(form({ name: '   ' }));
  assert.deepEqual(res, { ok: false, error: 'name' });
});

test('parseProfile: סוג עסק לא חוקי ⇐ שגיאת bad_request', () => {
  const res = parseProfile(form({ name: 'עסק', type: 'NOT_A_TYPE' }));
  assert.deepEqual(res, { ok: false, error: 'bad_request' });
});

test('parseProfile: בלי סוג ⇐ type null', () => {
  const res = parseProfile(form({ name: 'עסק' }));
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.type, null);
});

test('parsePolicy: ממפה מספרים ותיבת אישור', () => {
  const res = parsePolicy(
    form({
      minLeadTimeMinutes: '30',
      cancellationWindowHours: '24',
      slotGranularityMinutes: '15',
      maxAdvanceBookingDays: '60',
      bookingRequiresApproval: 'on',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    minLeadTimeMinutes: 30,
    cancellationWindowHours: 24,
    slotGranularityMinutes: 15,
    maxAdvanceBookingDays: 60,
    bookingRequiresApproval: true,
    requirePhoneVerification: false,
    allowBookingWithoutPhone: false,
  });
});

test('parsePolicy: מתגי משפך האורח נקראים מתיבות הסימון', () => {
  const res = parsePolicy(
    form({
      minLeadTimeMinutes: '30',
      cancellationWindowHours: '24',
      slotGranularityMinutes: '15',
      maxAdvanceBookingDays: '60',
      requirePhoneVerification: 'on',
      allowBookingWithoutPhone: 'on',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.requirePhoneVerification, true);
  assert.equal(res.data.allowBookingWithoutPhone, true);
});

test('parsePolicy: מספר לא חוקי ⇐ שגיאת number', () => {
  const res = parsePolicy(
    form({
      minLeadTimeMinutes: 'abc',
      cancellationWindowHours: '24',
      slotGranularityMinutes: '15',
      maxAdvanceBookingDays: '60',
    }),
  );
  assert.deepEqual(res, { ok: false, error: 'number' });
});

test('parseTransparency: תיבות סימון ⇐ בוליאני', () => {
  const res = parseTransparency(
    form({ showPricesPublic: 'on', showStaffPublic: '1' }),
  );
  assert.deepEqual(res, {
    showPricesPublic: true,
    showDurationPublic: false,
    showStaffPublic: true,
  });
});

test('parseTexts: ריק ⇐ null', () => {
  const res = parseTexts(form({ welcomeMessage: 'שלום' }));
  assert.deepEqual(res, {
    welcomeMessage: 'שלום',
    confirmationMessage: null,
    policyText: null,
  });
});

test('parseReminders: ערוץ חוקי נשמר', () => {
  const res = parseReminders(
    form({
      remindersEnabled: 'on',
      reminderChannel: 'SMS',
      reminderLeadHours: '3',
      confirmationRequired: 'on',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    remindersEnabled: true,
    reminderChannel: 'SMS',
    reminderLeadHours: 3,
    confirmationRequired: true,
  });
});

test('parseReminders: ערוץ לא חוקי ⇐ AUTO', () => {
  const res = parseReminders(
    form({ reminderChannel: 'CARRIER_PIGEON', reminderLeadHours: '2' }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.reminderChannel, 'AUTO');
});

test('parseReminders: שעות התראה לא חוקיות ⇐ שגיאת number', () => {
  const res = parseReminders(form({ reminderLeadHours: 'xyz' }));
  assert.deepEqual(res, { ok: false, error: 'number' });
});
