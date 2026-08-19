import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PHONE_OWNER_EMAIL_DOMAIN,
  ownerEmailForPhone,
  isPhoneOwnerEmail,
  phoneFromOwnerEmail,
} from './ownerPhoneIdentity';
import { isValidEmail, normalizePhone, isValidIsraeliMobile } from './crypto';

// גזירת כתובת מייל סינתטית ממספר טלפון של בעלים.
test('ownerEmailForPhone derives a deterministic synthetic email', () => {
  assert.equal(
    ownerEmailForPhone('+972501234567'),
    `972501234567@${PHONE_OWNER_EMAIL_DOMAIN}`,
  );
});

test('ownerEmailForPhone is stable for the same number', () => {
  assert.equal(ownerEmailForPhone('+972521112223'), ownerEmailForPhone('+972521112223'));
});

test('ownerEmailForPhone rejects non E.164 input', () => {
  assert.equal(ownerEmailForPhone('0501234567'), null);
  assert.equal(ownerEmailForPhone('972501234567'), null);
  assert.equal(ownerEmailForPhone(''), null);
  assert.equal(ownerEmailForPhone('+'), null);
});

// הכתובת הסינתטית חייבת לעבור את בדיקת התקינות של המערכת, אחרת שכבת הבעלות תדחה אותה.
test('synthetic owner email passes the app email validator', () => {
  const email = ownerEmailForPhone('+972501234567');
  assert.ok(email);
  assert.equal(isValidEmail(email!), true);
});

// הבחנה בין בעל טלפון (כתובת סינתטית) לבעל מייל אמיתי.
test('isPhoneOwnerEmail recognizes synthetic phone-owner emails', () => {
  assert.equal(isPhoneOwnerEmail('972501234567@phone.torchick.local'), true);
  assert.equal(isPhoneOwnerEmail('972501234567@PHONE.TORCHICK.LOCAL'), true);
});

test('isPhoneOwnerEmail leaves real email owners untouched', () => {
  // בעל מייל אמיתי לא מזוהה בטעות כבעל טלפון, ולכן אינו מושפע מהגשר.
  assert.equal(isPhoneOwnerEmail('owner@business.com'), false);
  assert.equal(isPhoneOwnerEmail('yaniv.golt@example.com'), false);
  assert.equal(isPhoneOwnerEmail('name@phone.torchick.local'), false); // local אינו ספרות
  assert.equal(isPhoneOwnerEmail(null), false);
  assert.equal(isPhoneOwnerEmail(undefined), false);
});

// שחזור המספר המקורי מהכתובת הסינתטית (round-trip).
test('phoneFromOwnerEmail round-trips the E.164 number', () => {
  const email = ownerEmailForPhone('+972501234567');
  assert.equal(phoneFromOwnerEmail(email), '+972501234567');
});

test('phoneFromOwnerEmail returns null for real emails', () => {
  assert.equal(phoneFromOwnerEmail('owner@business.com'), null);
});

// מסלול הבעלים בטלפון: נרמול ואימות מספר נייד ישראלי (הלוגיקה הטהורה סביב אימות הטוקן).
test('owner phone path normalizes Israeli mobile numbers to E.164', () => {
  assert.equal(normalizePhone('050-1234567'), '+972501234567');
  assert.equal(normalizePhone('0521112223'), '+972521112223');
  assert.equal(normalizePhone('+972 50 123 4567'), '+972501234567');
});

test('owner phone path accepts valid Israeli mobiles and rejects others', () => {
  assert.equal(isValidIsraeliMobile('050-1234567'), true);
  assert.equal(isValidIsraeliMobile('+972521112223'), true);
  assert.equal(isValidIsraeliMobile('03-1234567'), false); // קו נייח, לא נייד
  assert.equal(isValidIsraeliMobile('+15551234567'), false); // לא ישראלי
});
