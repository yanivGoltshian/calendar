import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGuestIdentity } from './guestIdentity';

test('מייל בלבד: מצליח, מנרמל מייל, וללא טלפון → NONE', () => {
  const result = resolveGuestIdentity('דנה', undefined, '  Guest@Mail.CO ');
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: undefined,
    email: 'guest@mail.co',
    verificationStatus: 'NONE',
  });
});

test('טלפון בלבד: מצליח, מנרמל ל-E.164, וללא מייל → UNVERIFIED', () => {
  const result = resolveGuestIdentity('דנה', '052-123-4567', undefined);
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: undefined,
    verificationStatus: 'UNVERIFIED',
  });
});

test('שניהם סופקו: שניהם נשמרים ומנורמלים; יש טלפון → UNVERIFIED', () => {
  const result = resolveGuestIdentity('דנה', '0521234567', 'guest@mail.co');
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: 'guest@mail.co',
    verificationStatus: 'UNVERIFIED',
  });
});

test('ללא שם: bad_request', () => {
  assert.deepEqual(resolveGuestIdentity('', undefined, 'guest@mail.co'), {
    ok: false,
    error: 'bad_request',
  });
});

test('שם קיים אך ללא טלפון וללא מייל: bad_request', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, undefined), {
    ok: false,
    error: 'bad_request',
  });
  // רווחים בלבד נחשבים ריקים.
  assert.deepEqual(resolveGuestIdentity('דנה', '   ', '   '), {
    ok: false,
    error: 'bad_request',
  });
});

test('טלפון לא-תקין: invalid_phone', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', '12345', undefined), {
    ok: false,
    error: 'invalid_phone',
  });
});

test('מייל לא-תקין: invalid_email', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, 'not-an-email'), {
    ok: false,
    error: 'invalid_email',
  });
});

// ----- שלוש רמות הזהות של המשפך "אורח תחילה" -----

test('רמת NONE: אורח עם שם בלבד כשהעסק מתיר הזמנה ללא טלפון (allowNoContact)', () => {
  const result = resolveGuestIdentity('סבתא רבקה', undefined, undefined, {
    allowNoContact: true,
  });
  assert.deepEqual(result, {
    ok: true,
    name: 'סבתא רבקה',
    phone: undefined,
    email: undefined,
    verificationStatus: 'NONE',
  });
});

test('רמת UNVERIFIED: אורח עם טלפון אך ללא OTP (ברירת המחדל של המשפך)', () => {
  const result = resolveGuestIdentity('דנה', '0521234567', undefined);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.verificationStatus, 'UNVERIFIED');
});

test('allowNoContact גובר על requireBoth: שם בלבד עובר גם במסלול הסטנדרט', () => {
  const result = resolveGuestIdentity('סבתא רבקה', undefined, undefined, {
    requireBoth: true,
    allowNoContact: true,
  });
  assert.deepEqual(result, {
    ok: true,
    name: 'סבתא רבקה',
    phone: undefined,
    email: undefined,
    verificationStatus: 'NONE',
  });
});

test('allowNoContact עם טלפון: עדיין UNVERIFIED (טלפון קיים גובר על NONE)', () => {
  const result = resolveGuestIdentity('דנה', '0521234567', undefined, {
    allowNoContact: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.verificationStatus, 'UNVERIFIED');
});

test('מסלול סטנדרט (requireBoth) ללא allowNoContact: חסר טלפון → phone_required', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, 'guest@mail.co', { requireBoth: true }), {
    ok: false,
    error: 'phone_required',
  });
});

test('מסלול סטנדרט (requireBoth) ללא allowNoContact: חסר מייל → email_required', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', '0521234567', undefined, { requireBoth: true }), {
    ok: false,
    error: 'email_required',
  });
});

// ----- מטריצת הבעלים: requirePhone / requireEmail מפורשים ובלתי-תלויים (מנותקים מהמסלול) -----
// ארבעת הצירופים שהבעלים שולט בהם דרך requireEmail + allowBookingWithoutPhone:
//   [allowNoPhone=false, requireEmail=true]  → phone+email (ברירת מחדל מומלצת)
//   [allowNoPhone=false, requireEmail=false] → phone בלבד
//   [allowNoPhone=true,  requireEmail=true]  → מייל חובה, טלפון רשות
//   [allowNoPhone=true,  requireEmail=false] → שם בלבד (אורח תחילה מלא)

test('מטריצה [phone+email]: requirePhone+requireEmail — חסר מייל → email_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', '0521234567', undefined, { requirePhone: true, requireEmail: true }),
    { ok: false, error: 'email_required' },
  );
});

test('מטריצה [phone+email]: requirePhone+requireEmail — חסר טלפון → phone_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', undefined, 'guest@mail.co', { requirePhone: true, requireEmail: true }),
    { ok: false, error: 'phone_required' },
  );
});

test('מטריצה [phone+email]: שניהם סופקו → מצליח (UNVERIFIED)', () => {
  const r = resolveGuestIdentity('דנה', '0521234567', 'guest@mail.co', { requirePhone: true, requireEmail: true });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.verificationStatus, 'UNVERIFIED');
});

test('מטריצה [phone בלבד]: requirePhone, requireEmail=false — טלפון בלי מייל → מצליח', () => {
  const r = resolveGuestIdentity('דנה', '0521234567', undefined, { requirePhone: true, requireEmail: false });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.verificationStatus, 'UNVERIFIED');
});

test('מטריצה [phone בלבד]: requirePhone — חסר טלפון → phone_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', undefined, 'guest@mail.co', { requirePhone: true, requireEmail: false }),
    { ok: false, error: 'phone_required' },
  );
});

test('מטריצה [מייל חובה, טלפון רשות]: allowNoContact + requireEmail — חסר מייל → email_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', undefined, undefined, { requirePhone: false, requireEmail: true, allowNoContact: true }),
    { ok: false, error: 'email_required' },
  );
});

test('מטריצה [מייל חובה, טלפון רשות]: מייל בלבד עובר, ללא טלפון → NONE', () => {
  const r = resolveGuestIdentity('דנה', undefined, 'guest@mail.co', {
    requirePhone: false,
    requireEmail: true,
    allowNoContact: true,
  });
  assert.deepEqual(r, {
    ok: true,
    name: 'דנה',
    phone: undefined,
    email: 'guest@mail.co',
    verificationStatus: 'NONE',
  });
});

test('מטריצה [שם בלבד]: allowNoContact, ללא דרישות — שם בלבד עובר → NONE', () => {
  const r = resolveGuestIdentity('סבתא רבקה', undefined, undefined, {
    requirePhone: false,
    requireEmail: false,
    allowNoContact: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.verificationStatus, 'NONE');
});
