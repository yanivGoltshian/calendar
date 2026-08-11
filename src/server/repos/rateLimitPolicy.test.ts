import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateOtpRateLimit,
  getRateLimitConfig,
  type RateLimitConfig,
} from './rateLimitPolicy';

const NOW = 1_700_000_000_000;

function config(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return {
    cooldownSeconds: 60,
    phoneDailyCap: 8,
    ipDailyCap: 30,
    windowMs: 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

// ---------- getRateLimitConfig ----------

test('getRateLimitConfig מחזיר ברירות מחדל בטוחות ללא env', () => {
  const c = getRateLimitConfig({});
  assert.equal(c.cooldownSeconds, 60);
  assert.equal(c.phoneDailyCap, 8);
  assert.equal(c.ipDailyCap, 30);
});

test('getRateLimitConfig קורא דריסות מ-env', () => {
  const c = getRateLimitConfig({
    OTP_COOLDOWN_SECONDS: '45',
    OTP_MAX_PER_PHONE_PER_DAY: '5',
    OTP_MAX_PER_IP_PER_DAY: '12',
  });
  assert.equal(c.cooldownSeconds, 45);
  assert.equal(c.phoneDailyCap, 5);
  assert.equal(c.ipDailyCap, 12);
});

test('getRateLimitConfig מתעלם מערכים לא חוקיים ונופל לברירת המחדל', () => {
  const c = getRateLimitConfig({
    OTP_COOLDOWN_SECONDS: '-3',
    OTP_MAX_PER_PHONE_PER_DAY: 'abc',
    OTP_MAX_PER_IP_PER_DAY: '0',
  });
  assert.equal(c.cooldownSeconds, 60);
  assert.equal(c.phoneDailyCap, 8);
  assert.equal(c.ipDailyCap, 30);
});

// ---------- evaluateOtpRateLimit ----------

test('מותר כשאין היסטוריה', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: null,
    phoneCountInWindow: 0,
    ipCountInWindow: 0,
    config: config(),
  });
  assert.deepEqual(d, { allowed: true });
});

test('קול-דאון: בקשה חוזרת מוקדם מדי נחסמת עם retryAfter', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: NOW - 10_000, // עברו 10 שניות מתוך 60
    phoneCountInWindow: 1,
    ipCountInWindow: 1,
    config: config(),
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'cooldown');
    assert.ok(d.retryAfterSeconds > 0 && d.retryAfterSeconds <= 60);
  }
});

test('קול-דאון: לאחר שחלף הזמן הבקשה מותרת', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: NOW - 61_000,
    phoneCountInWindow: 1,
    ipCountInWindow: 1,
    config: config(),
  });
  assert.deepEqual(d, { allowed: true });
});

test('תקרת טלפון: חסימה בהגעה לתקרה היומית', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: NOW - 3_600_000, // מעבר לקול-דאון
    phoneCountInWindow: 8,
    ipCountInWindow: 1,
    config: config(),
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'phone_cap');
    assert.ok(d.retryAfterSeconds >= 60);
  }
});

test('תקרת IP: חסימה בהגעה לתקרה גם כשהטלפון תקין', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: null,
    phoneCountInWindow: 0,
    ipCountInWindow: 30,
    config: config(),
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'ip_cap');
  }
});

test('סדר עדיפויות: קול-דאון קודם לתקרת טלפון', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: NOW - 5_000,
    phoneCountInWindow: 100,
    ipCountInWindow: 100,
    config: config(),
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'cooldown');
  }
});

test('סדר עדיפויות: תקרת טלפון קודמת לתקרת IP', () => {
  const d = evaluateOtpRateLimit({
    now: NOW,
    lastPhoneSentAt: null,
    phoneCountInWindow: 8,
    ipCountInWindow: 30,
    config: config(),
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.equal(d.reason, 'phone_cap');
  }
});
