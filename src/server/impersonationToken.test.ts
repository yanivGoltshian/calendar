import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  signImpersonationValue,
  verifyImpersonationValue,
  resolveImpersonatedBusinessId,
  IMPERSONATION_TTL_SECONDS,
  type ImpersonationToken,
} from './impersonationToken';

// סוד קבוע וזמן קבוע לבדיקות דטרמיניסטיות (ללא תלות בסביבה/שעון).
const SECRET = 'test-secret-אבגד-123';
const NOW = 1_700_000_000_000; // אלפיות שנייה

// --- signImpersonationValue / verifyImpersonationValue: הלוך-ושוב ---

test('חתימה ואימות: הלוך-ושוב מחזיר את אותו מזהה עסק', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  const token = verifyImpersonationValue(raw, { secret: SECRET, nowMs: NOW });
  assert.ok(token);
  assert.equal(token?.businessId, 'biz_123');
});

test('חתימה: מבנה שני חלקים מופרדים בנקודה (payload.sig)', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  const parts = raw.split('.');
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length > 0);
  assert.ok(parts[1].length > 0);
});

test('חתימה: exp נקבע לפי nowMs + TTL', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  const token = verifyImpersonationValue(raw, { secret: SECRET, nowMs: NOW });
  assert.equal(token?.exp, Math.floor(NOW / 1000) + IMPERSONATION_TTL_SECONDS);
});

// --- זיוף/שינוי ⇒ null ---

test('אימות: ערך מחובל (payload ששונה) נדחה', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  const [, sig] = raw.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ businessId: 'biz_evil', exp: 9_999_999_999, nonce: 'x' }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const tampered = `${forgedPayload}.${sig}`;
  assert.equal(verifyImpersonationValue(tampered, { secret: SECRET, nowMs: NOW }), null);
});

test('אימות: חתימה מחובלת נדחית', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  const [payload] = raw.split('.');
  assert.equal(verifyImpersonationValue(`${payload}.deadbeef`, { secret: SECRET, nowMs: NOW }), null);
});

test('אימות: סוד שגוי נדחה', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW });
  assert.equal(verifyImpersonationValue(raw, { secret: 'wrong-secret', nowMs: NOW }), null);
});

// --- פקיעת תוקף ⇒ null ---

test('אימות: אסימון שפג תוקפו נדחה', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW, ttlSeconds: 60 });
  // 61 שניות אחרי החתימה — מעבר לתוקף.
  const later = NOW + 61 * 1000;
  assert.equal(verifyImpersonationValue(raw, { secret: SECRET, nowMs: later }), null);
});

test('אימות: בתוך חלון התוקף — מתקבל', () => {
  const raw = signImpersonationValue('biz_123', { secret: SECRET, nowMs: NOW, ttlSeconds: 3600 });
  const later = NOW + 1800 * 1000; // חצי שעה
  const token = verifyImpersonationValue(raw, { secret: SECRET, nowMs: later });
  assert.equal(token?.businessId, 'biz_123');
});

// --- קלט פגום/ריק ⇒ null ---

test('אימות: קלט ריק/חסר/פורמט שגוי נדחה', () => {
  assert.equal(verifyImpersonationValue(null, { secret: SECRET, nowMs: NOW }), null);
  assert.equal(verifyImpersonationValue(undefined, { secret: SECRET, nowMs: NOW }), null);
  assert.equal(verifyImpersonationValue('', { secret: SECRET, nowMs: NOW }), null);
  assert.equal(verifyImpersonationValue('no-dot', { secret: SECRET, nowMs: NOW }), null);
  assert.equal(verifyImpersonationValue('a.b.c', { secret: SECRET, nowMs: NOW }), null);
});

// --- resolveImpersonatedBusinessId: שער האמון הטהור ---

const validToken: ImpersonationToken = { businessId: 'biz_123', exp: 9_999_999_999, nonce: 'n' };

test('החלטה: מנהל-על עם אסימון תקף ⇒ מזהה העסק', () => {
  assert.equal(
    resolveImpersonatedBusinessId({ token: validToken, isPlatformAdmin: true }),
    'biz_123',
  );
});

test('החלטה: לא מנהל-על ⇒ null גם עם אסימון תקף', () => {
  assert.equal(
    resolveImpersonatedBusinessId({ token: validToken, isPlatformAdmin: false }),
    null,
  );
});

test('החלטה: מנהל-על ללא אסימון ⇒ null', () => {
  assert.equal(resolveImpersonatedBusinessId({ token: null, isPlatformAdmin: true }), null);
});
