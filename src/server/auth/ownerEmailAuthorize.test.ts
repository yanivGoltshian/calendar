import { test } from 'node:test';
import assert from 'node:assert/strict';

import { authorizeOwnerEmail, type OwnerEmailAuthorizeDeps } from './ownerEmailAuthorize';

/** בונה תלויות מדומות (DI) עם מעקב אחר הקריאות, כדי לבדוק את הלוגיקה בלי NextAuth/Prisma. */
function makeDeps(overrides: Partial<OwnerEmailAuthorizeDeps> = {}) {
  const calls = {
    checkOtp: [] as Array<{ identity: string; code: string }>,
    findOrCreate: [] as Array<{ email: string; name?: string }>,
  };
  const deps: OwnerEmailAuthorizeDeps = {
    checkOtp: async (identity, code) => {
      calls.checkOtp.push({ identity, code });
      return { ok: true };
    },
    findOrCreateUserByEmail: async (email, name) => {
      calls.findOrCreate.push({ email, name });
      return { id: 'user-1', email, name: name ?? null };
    },
    ...overrides,
  };
  return { deps, calls };
}

test('מקבל {email, code} תקינים ומחזיר משתמש מזוהה-מייל', async () => {
  const { deps, calls } = makeDeps();
  const result = await authorizeOwnerEmail({ email: 'owner@torchick.co', code: '123456' }, deps);
  assert.deepEqual(result, { id: 'user-1', email: 'owner@torchick.co', name: undefined });
  assert.equal(calls.checkOtp.length, 1);
  assert.equal(calls.findOrCreate.length, 1);
});

test('מנרמל את המייל (trim + lowercase) לפני checkOtp ו-findOrCreate', async () => {
  const { deps, calls } = makeDeps();
  await authorizeOwnerEmail({ email: '  Owner@Torchick.CO  ', code: '123456' }, deps);
  assert.equal(calls.checkOtp[0]?.identity, 'owner@torchick.co');
  assert.equal(calls.findOrCreate[0]?.email, 'owner@torchick.co');
});

test('דוחה מייל לא-תקין בלי לקרוא לתלויות', async () => {
  const { deps, calls } = makeDeps();
  const result = await authorizeOwnerEmail({ email: 'not-an-email', code: '123456' }, deps);
  assert.equal(result, null);
  assert.equal(calls.checkOtp.length, 0);
  assert.equal(calls.findOrCreate.length, 0);
});

test('דוחה קוד קצר מארבע ספרות בלי לקרוא לתלויות', async () => {
  const { deps, calls } = makeDeps();
  const result = await authorizeOwnerEmail({ email: 'owner@torchick.co', code: '12' }, deps);
  assert.equal(result, null);
  assert.equal(calls.checkOtp.length, 0);
});

test('כשל OTP מחזיר null ולא יוצר משתמש', async () => {
  const { deps, calls } = makeDeps({ checkOtp: async () => ({ ok: false }) });
  const result = await authorizeOwnerEmail({ email: 'owner@torchick.co', code: '999999' }, deps);
  assert.equal(result, null);
  assert.equal(calls.findOrCreate.length, 0);
});

test('נופל חזרה למייל המנורמל כשלמשתמש שנוצר אין מייל', async () => {
  const { deps } = makeDeps({
    findOrCreateUserByEmail: async () => ({ id: 'u2', email: null, name: 'שם' }),
  });
  const result = await authorizeOwnerEmail({ email: 'owner@torchick.co', code: '123456' }, deps);
  assert.deepEqual(result, { id: 'u2', email: 'owner@torchick.co', name: 'שם' });
});
