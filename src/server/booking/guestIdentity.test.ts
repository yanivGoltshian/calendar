import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGuestIdentity } from './guestIdentity';

/**
 * מדיניות זהות אורח לפי מסלול (מקור אמת ב-src/server/tier.ts):
 *   - שם + טלפון חובה בכל המסלולים (כולל סטנדרט). ההזמנה נעשית כאורח ללא הרשמה.
 *   - מייל נדרש רק בפרימיום/אקסקלוסיב (requireEmail=true), שם נשלח אישור/תזכורת במייל.
 *     בסטנדרט המייל אינו נאסף כלל.
 */

// ── סטנדרט (requireEmail ברירת מחדל=false): שם + טלפון חובה, מייל לא נאסף ──────

test('סטנדרט: שם + טלפון תקין מצליח, מנרמל ל-E.164, ללא מייל', () => {
  const result = resolveGuestIdentity('דנה', '052-123-4567', undefined);
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: undefined,
  });
});

test('סטנדרט: מייל ללא טלפון נכשל ב-phone_required (טלפון חובה בכל מסלול)', () => {
  const result = resolveGuestIdentity('דנה', undefined, 'guest@mail.co');
  assert.deepEqual(result, { ok: false, error: 'phone_required' });
});

test('סטנדרט: שם קיים אך ללא טלפון וללא מייל → phone_required', () => {
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, undefined), {
    ok: false,
    error: 'phone_required',
  });
  // רווחים בלבד נחשבים ריקים.
  assert.deepEqual(resolveGuestIdentity('דנה', '   ', '   '), {
    ok: false,
    error: 'phone_required',
  });
});

test('ללא שם: bad_request (נבדק ראשון)', () => {
  assert.deepEqual(resolveGuestIdentity('', '0521234567', 'guest@mail.co'), {
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

// ── פרימיום/אקסקלוסיב (requireEmail=true): שם + טלפון + מייל חובה ──────────────

test('פרימיום: שם + טלפון + מייל תקינים מצליח ומנרמל את שניהם', () => {
  const result = resolveGuestIdentity('דנה', '0521234567', '  Guest@Mail.CO ', {
    requireEmail: true,
  });
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: 'guest@mail.co',
  });
});

test('פרימיום: טלפון תקין אך ללא מייל → email_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', '0521234567', undefined, { requireEmail: true }),
    { ok: false, error: 'email_required' },
  );
});

test('פרימיום: חסר טלפון נבדק לפני חסר מייל → phone_required', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', undefined, 'guest@mail.co', { requireEmail: true }),
    { ok: false, error: 'phone_required' },
  );
});

test('פרימיום: מייל לא-תקין (עם טלפון תקין) → invalid_email', () => {
  assert.deepEqual(
    resolveGuestIdentity('דנה', '0521234567', 'not-an-email', { requireEmail: true }),
    { ok: false, error: 'invalid_email' },
  );
});
