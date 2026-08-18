import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isValidEmail, normalizeEmail, hashOtp, verifyOtp } from './crypto';
import { serializeSession, parseSession, type ClientSession } from './session';

test('isValidEmail accepts reasonable addresses', () => {
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('yaniv.golt@example.com'), true);
  assert.equal(isValidEmail('  spaced@example.com  '), true);
});

test('isValidEmail rejects malformed input', () => {
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('no-at-sign'), false);
  assert.equal(isValidEmail('missing@tld'), false);
  assert.equal(isValidEmail('a b@c.com'), false);
  assert.equal(isValidEmail('@nolocal.com'), false);
});

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Yaniv@Example.COM '), 'yaniv@example.com');
});

test('ClientSession round-trips an email-only session', () => {
  const session: ClientSession = {
    userId: 'u1',
    email: 'client@example.com',
    name: 'לקוח',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token = serializeSession(session);
  const parsed = parseSession(token);
  assert.ok(parsed);
  assert.equal(parsed?.userId, 'u1');
  assert.equal(parsed?.email, 'client@example.com');
  assert.equal(parsed?.phone, undefined);
});

test('ClientSession parses legacy phone-only cookies (backward compat)', () => {
  // עוגייה "ישנה" ללא email — חייבת להמשיך להיפרס תקין.
  const legacy: ClientSession = {
    userId: 'u2',
    phone: '+972501234567',
    name: 'ותיק',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token = serializeSession(legacy);
  const parsed = parseSession(token);
  assert.ok(parsed);
  assert.equal(parsed?.phone, '+972501234567');
  assert.equal(parsed?.email, undefined);
});

test('ClientSession rejects a tampered token', () => {
  const token = serializeSession({ userId: 'u3', phone: '+972500000000', exp: Math.floor(Date.now() / 1000) + 3600 });
  const [payload] = token.split('.');
  const forged = `${payload}.deadbeef`;
  assert.equal(parseSession(forged), null);
});

test('ClientSession rejects an expired token', () => {
  const token = serializeSession({ userId: 'u4', email: 'old@example.com', exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal(parseSession(token), null);
});

test('OTP verify succeeds for the right code and fails otherwise (email identity)', () => {
  const identity = 'client@example.com';
  const stored = hashOtp('123456', identity);
  assert.equal(verifyOtp('123456', identity, stored), true);
  assert.equal(verifyOtp('000000', identity, stored), false);
  // אותו קוד מול זהות אחרת נכשל.
  assert.equal(verifyOtp('123456', 'other@example.com', stored), false);
});

test('OTP verify works for phone identity too (no regression)', () => {
  const identity = '+972501234567';
  const stored = hashOtp('654321', identity);
  assert.equal(verifyOtp('654321', identity, stored), true);
  assert.equal(verifyOtp('654320', identity, stored), false);
});
