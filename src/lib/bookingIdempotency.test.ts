import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingAttemptForPayload,
  isSuccessfulBookingReceipt,
} from './bookingIdempotency';

const payload = {
  slug: 'fixture',
  staffId: 'staff',
  serviceIds: ['service'],
  startAtUtc: '2026-09-07T09:00:00Z',
  name: 'Guest',
  phone: '0501234567',
  email: 'guest@example.com',
};

test('only pending or confirmed receipts can show a booking success screen', () => {
  for (const status of ['PENDING', 'CONFIRMED']) {
    assert.equal(
      isSuccessfulBookingReceipt({ ok: true, appointmentId: 'receipt', status }),
      true,
    );
  }
  for (const status of ['CANCELLED', 'DONE', 'COMPLETED', 'NO_SHOW', undefined]) {
    assert.equal(
      isSuccessfulBookingReceipt({ ok: true, appointmentId: 'receipt', status }),
      false,
    );
  }
  for (const value of [
    null,
    {},
    { ok: true, status: 'CONFIRMED' },
    { ok: false, appointmentId: 'receipt', status: 'CONFIRMED' },
    { ok: true, appointmentId: '', status: 'CONFIRMED' },
  ]) {
    assert.equal(isSuccessfulBookingReceipt(value), false);
  }
});

test('the same exact booking payload keeps its random UUID through retries', async () => {
  const body = JSON.stringify(payload);
  const attempt = await bookingAttemptForPayload(null, body, null);
  assert.match(attempt.key, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  assert.match(attempt.fingerprint, /^[a-f0-9]{64}$/);
  for (const outcome of ['network failure', 'invalid JSON', '429', '500', '409']) {
    assert.strictEqual(
      await bookingAttemptForPayload(attempt, body, null),
      attempt,
      outcome,
    );
  }
});

test('tenant, staff, service, time and contact changes rotate the key', async () => {
  const attempt = await bookingAttemptForPayload(null, JSON.stringify(payload), null);
  const changes = [
    { slug: 'other' },
    { staffId: 'other' },
    { serviceIds: ['other'] },
    { startAtUtc: '2026-09-07T10:00:00Z' },
    { name: 'Other Guest' },
    { phone: '0509876543' },
    { email: 'other@example.com' },
  ];
  for (const change of changes) {
    const next = await bookingAttemptForPayload(
      attempt,
      JSON.stringify({ ...payload, ...change }),
      null,
    );
    assert.notEqual(next.key, attempt.key);
    assert.notEqual(next.fingerprint, attempt.fingerprint);
  }
});

test('identity changes and a cleared successful attempt start a new UUID', async () => {
  const body = JSON.stringify(payload);
  const original = await bookingAttemptForPayload(null, body, null);
  const signedIn = await bookingAttemptForPayload(original, body, 'signed-in-customer');
  assert.notEqual(signedIn.key, original.key);
  assert.strictEqual(
    await bookingAttemptForPayload(signedIn, body, 'signed-in-customer'),
    signedIn,
  );
  assert.notEqual(
    (await bookingAttemptForPayload(null, body, 'signed-in-customer')).key,
    signedIn.key,
  );
});
