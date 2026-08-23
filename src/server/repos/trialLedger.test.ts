import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTrialDecision, computeTrialHashes } from './trialLedger';

const DAY_MS = 24 * 60 * 60 * 1000;

test('resolveTrialDecision: מבקר ראשון מקבל ניסיון חדש של 30 יום ומצב trialing', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const d = resolveTrialDecision(null, now);
  assert.equal(d.isReturning, false);
  assert.equal(d.subscriptionStatus, 'trialing');
  assert.equal(d.trialEndsAt.getTime(), now.getTime() + 30 * DAY_MS);
});

test('resolveTrialDecision: הרשמה חוזרת כשהניסיון המקורי עדיין בתוקף — משתמשים בתאריך המקורי, trialing', () => {
  const now = new Date('2026-01-10T00:00:00.000Z');
  const original = new Date('2026-01-20T00:00:00.000Z'); // עוד בעתיד
  const d = resolveTrialDecision(original, now);
  assert.equal(d.isReturning, true);
  assert.equal(d.subscriptionStatus, 'trialing');
  assert.equal(d.trialEndsAt.getTime(), original.getTime()); // ללא הארכה
});

test('resolveTrialDecision: הרשמה חוזרת אחרי שהניסיון המקורי פג — נולד expired', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  const original = new Date('2026-01-31T00:00:00.000Z'); // כבר עבר
  const d = resolveTrialDecision(original, now);
  assert.equal(d.isReturning, true);
  assert.equal(d.subscriptionStatus, 'expired');
  assert.equal(d.trialEndsAt.getTime(), original.getTime());
});

test('resolveTrialDecision: מכבד trialDays מותאם', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const d = resolveTrialDecision(null, now, 14);
  assert.equal(d.trialEndsAt.getTime(), now.getTime() + 14 * DAY_MS);
});

test('computeTrialHashes: hash של מייל אינו תלוי-רישיות ודטרמיניסטי', () => {
  const a = computeTrialHashes('Foo.Bar@Example.COM', null);
  const b = computeTrialHashes('foo.bar@example.com', null);
  assert.equal(a.emailHash, b.emailHash);
  assert.match(a.emailHash, /^[0-9a-f]{64}$/); // sha256 hex
});

test('computeTrialHashes: מיילים שונים נותנים hash שונה', () => {
  const a = computeTrialHashes('a@example.com', null);
  const b = computeTrialHashes('b@example.com', null);
  assert.notEqual(a.emailHash, b.emailHash);
});

test('computeTrialHashes: טלפון ריק או null מחזיר phoneHash=null', () => {
  assert.equal(computeTrialHashes('x@example.com', null).phoneHash, null);
  assert.equal(computeTrialHashes('x@example.com', '').phoneHash, null);
  assert.equal(computeTrialHashes('x@example.com', '   ').phoneHash, null);
});

test('computeTrialHashes: טלפון ישראלי תקין מחזיר phoneHash דטרמיניסטי לפי E.164', () => {
  // צורות שונות של אותו מספר אמורות להתנרמל לאותו E.164 ולכן לאותו hash
  const a = computeTrialHashes('x@example.com', '050-123-4567');
  const b = computeTrialHashes('x@example.com', '+972501234567');
  assert.ok(a.phoneHash);
  assert.match(a.phoneHash, /^[0-9a-f]{64}$/);
  assert.equal(a.phoneHash, b.phoneHash);
});

test('computeTrialHashes: טלפון לא תקין אינו זורק ומחזיר phoneHash=null', () => {
  const r = computeTrialHashes('x@example.com', 'not-a-phone');
  assert.equal(r.phoneHash, null);
  assert.match(r.emailHash, /^[0-9a-f]{64}$/);
});

test('computeTrialHashes: hash של מייל ושל טלפון נבדלים זה מזה', () => {
  const r = computeTrialHashes('same@example.com', '050-123-4567');
  assert.notEqual(r.emailHash, r.phoneHash);
});
