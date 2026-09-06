import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentGoogleEventId } from './appointmentSync';
import { insertEvent } from './calendarClient';

test('appointment event IDs are stable valid Google base32hex IDs', () => {
  const id = appointmentGoogleEventId('appointment-one');
  assert.match(id, /^[0-9a-v]{5,1024}$/);
  assert.equal(id, appointmentGoogleEventId('appointment-one'));
  assert.notEqual(id, appointmentGoogleEventId('appointment-two'));
});

test('Google insertion transmits deterministic ID and treats duplicate conflict as idempotent success', async () => {
  const original = global.fetch;
  const id = appointmentGoogleEventId('retry');
  global.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.id, id);
    return new Response('', { status: 409 });
  };
  try {
    assert.equal(await insertEvent({
      accessToken: 'test-not-live', calendarId: 'test',
      event: { id, summary: 'Test', start: new Date(), end: new Date() },
    }), id);
  } finally {
    global.fetch = original;
  }
});
