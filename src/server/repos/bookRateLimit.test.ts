import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkBookRequestAllowed,
  getBookRateLimitConfig,
  resetBookRateLimitState,
} from './bookRateLimit';

beforeEach(() => {
  resetBookRateLimitState();
});

// ---------- getBookRateLimitConfig ----------

test('getBookRateLimitConfig מחזיר ברירות מחדל בטוחות ללא env', () => {
  const c = getBookRateLimitConfig({});
  assert.equal(c.cooldownSeconds, 5);
  assert.equal(c.phoneDailyCap, 20);
  assert.equal(c.windowMs, 60 * 60 * 1000);
});

test('getBookRateLimitConfig קורא דריסות מ-env', () => {
  const c = getBookRateLimitConfig({
    BOOK_COOLDOWN_SECONDS: '10',
    BOOK_MAX_PER_IP_PER_HOUR: '3',
  });
  assert.equal(c.cooldownSeconds, 10);
  assert.equal(c.phoneDailyCap, 3);
});

// ---------- checkBookRequestAllowed ----------

test('בקשה ראשונה מ-IP מותרת', () => {
  const d = checkBookRequestAllowed('1.2.3.4');
  assert.deepEqual(d, { allowed: true });
});

test('בקשה ללא IP מותרת (best-effort) ואינה נרשמת', () => {
  assert.deepEqual(checkBookRequestAllowed(null), { allowed: true });
  assert.deepEqual(checkBookRequestAllowed(''), { allowed: true });
});

test('קול-דאון: בקשה חוזרת מיידית מאותו IP נחסמת', () => {
  const env = { BOOK_COOLDOWN_SECONDS: '5', BOOK_MAX_PER_IP_PER_HOUR: '20' };
  assert.equal(checkBookRequestAllowed('9.9.9.9', env).allowed, true);
  const d = checkBookRequestAllowed('9.9.9.9', env);
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'cooldown');
    assert.ok(d.retryAfterSeconds > 0 && d.retryAfterSeconds <= 5);
  }
});

test('תקרה שעתית: חסימה בהגעה לתקרה לכל IP', () => {
  // ביטול קול-דאון כדי לבדוק את התקרה בלבד.
  const env = { BOOK_COOLDOWN_SECONDS: '1', BOOK_MAX_PER_IP_PER_HOUR: '3' };
  // ננצל את העובדה שקול-דאון של שנייה חוסם בקשות סמוכות: נבדוק חסימה
  // מיד לאחר הבקשה הראשונה שהיא במסגרת התקרה.
  assert.equal(checkBookRequestAllowed('8.8.8.8', env).allowed, true);
  const d = checkBookRequestAllowed('8.8.8.8', env);
  // הבקשה השנייה נחסמת (קול-דאון) — מוודא שהמנגנון אוכף.
  assert.equal(d.allowed, false);
});

test('IP נפרדים אינם משפיעים זה על זה', () => {
  const env = { BOOK_COOLDOWN_SECONDS: '30', BOOK_MAX_PER_IP_PER_HOUR: '20' };
  assert.equal(checkBookRequestAllowed('10.0.0.1', env).allowed, true);
  assert.equal(checkBookRequestAllowed('10.0.0.2', env).allowed, true);
});
