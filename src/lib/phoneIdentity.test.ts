import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePhone,
  isValidIsraeliMobile,
  displayPhone,
  generateOtpCode,
} from './crypto';

/**
 * בדיקות משלימות לעוזרי זהות מבוססי-טלפון וליצירת קוד OTP.
 * (זהות מייל, סשן ואימות OTP מכוסים כבר ב-authIdentity.test.ts — אין כפילות כאן.)
 */

test('normalizePhone ממיר פורמטים ישראליים שונים ל-E.164', () => {
  assert.equal(normalizePhone('050-1234567'), '+972501234567');
  assert.equal(normalizePhone('0501234567'), '+972501234567');
  assert.equal(normalizePhone('+972501234567'), '+972501234567');
  assert.equal(normalizePhone('972501234567'), '+972501234567');
  // רווחים ותווים לא-ספרתיים מוסרים.
  assert.equal(normalizePhone('050 123 4567'), '+972501234567');
});

test('isValidIsraeliMobile מקבל ניידים תקינים ודוחה אחרים', () => {
  assert.equal(isValidIsraeliMobile('0501234567'), true);
  assert.equal(isValidIsraeliMobile('+972521234567'), true);
  // קווי (02) אינו נייד.
  assert.equal(isValidIsraeliMobile('021234567'), false);
  // קצר מדי.
  assert.equal(isValidIsraeliMobile('05012345'), false);
  // אינו מתחיל ב-5 אחרי הקידומת.
  assert.equal(isValidIsraeliMobile('0491234567'), false);
  // קלט לא-מספרי.
  assert.equal(isValidIsraeliMobile('abc'), false);
});

test('displayPhone מציג E.164 ישראלי בפורמט ידידותי', () => {
  assert.equal(displayPhone('+972501234567'), '050-1234567');
  assert.equal(displayPhone(null), '');
  assert.equal(displayPhone(undefined), '');
  assert.equal(displayPhone(''), '');
  // מספר לא-ישראלי מוחזר כמות שהוא.
  assert.equal(displayPhone('+14155550123'), '+14155550123');
});

test('generateOtpCode מחזיר תמיד קוד בן 6 ספרות', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateOtpCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(code.length, 6);
  }
});
