import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGuestIdentity } from './guestIdentity';

test('מייל בלבד: מצליח, מנרמל מייל, וללא טלפון (מסלול מייל בלבד)', () => {
  const result = resolveGuestIdentity('דנה', undefined, '  Guest@Mail.CO ');
  assert.deepEqual(result, { ok: true, name: 'דנה', phone: undefined, email: 'guest@mail.co' });
});

test('טלפון בלבד: מצליח, מנרמל ל-E.164, וללא מייל', () => {
  const result = resolveGuestIdentity('דנה', '052-123-4567', undefined);
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: undefined,
  });
});

test('שניהם סופקו: שניהם נשמרים ומנורמלים', () => {
  const result = resolveGuestIdentity('דנה', '0521234567', 'guest@mail.co');
  assert.deepEqual(result, {
    ok: true,
    name: 'דנה',
    phone: '+972521234567',
    email: 'guest@mail.co',
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
