import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_FORM_BODY_LIMIT, createAdminFormPost } from './adminFormRoute';
import { parseAdminFormState } from '../lib/adminFormState';

const origin = 'http://localhost:3188';
function request(headers: Record<string, string> = { origin }) {
  const body = new FormData();
  body.set('name', 'Synthetic value');
  return new Request(`${origin}/api/admin/settings`, { method: 'POST', headers, body });
}

test('browser form transport rejects missing/cross-origin requests and unauthorized owners before mutation', async () => {
  let called = 0;
  const save = async () => { called++; return { ok: true }; };
  const post = createAdminFormPost(save, async () => true, origin);
  assert.equal((await post(request({}))).status, 403);
  assert.equal((await post(request({ origin: 'https://other.example.invalid' }))).status, 403);
  assert.equal((await createAdminFormPost(save, async () => false, origin)(request())).status, 403);
  assert.equal(called, 0);
});

test('browser form transport enforces multipart format and the existing nine-megabyte request ceiling', async () => {
  let called = 0;
  const post = createAdminFormPost(async () => { called++; return { ok: true }; }, async () => true, origin);
  assert.equal((await post(new Request(`${origin}/api/admin/settings`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}',
  }))).status, 415);
  const oversized = request({ origin, 'content-length': String(ADMIN_FORM_BODY_LIMIT + 1) });
  assert.equal((await post(oversized)).status, 413);
  const malformed = new Request(`${origin}/api/admin/settings`, {
    method: 'POST', headers: { origin, 'content-type': 'multipart/form-data; boundary=synthetic' }, body: 'invalid',
  });
  assert.equal((await post(malformed)).status, 400);
  assert.equal(called, 0);
});

test('browser form transport preserves validations, emits no-store public state and surfaces unexpected failures', async () => {
  const post = createAdminFormPost(async data => {
    assert.equal(data.get('name'), 'Synthetic value');
    return { ok: true, scheduled: true, privateField: 'never serialize' };
  }, async () => true, origin);
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, scheduled: true });
  const rejected = await createAdminFormPost(async () => ({ ok: false, error: 'name' }), async () => true, origin)(request());
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { ok: false, error: 'name' });
  await assert.rejects(createAdminFormPost(async () => { throw new Error('Synthetic DB failure'); }, async () => true, origin)(request()),
    /Synthetic DB failure/);
  for (const value of [null, {}, { ok: 'true' }, { ok: true, scheduled: 'yes' }, { ok: true, mode: 'delete' }]) {
    assert.throws(() => parseAdminFormState(value));
  }
});

test('browser form origin validation supports the trusted public proxy origin and rejects forwarded-host spoofing', async () => {
  const canonical = 'https://public.example.invalid';
  const post = createAdminFormPost(async () => ({ ok: true }), async () => true, canonical);
  const body = new FormData();
  body.set('name', 'Synthetic');
  assert.equal((await post(new Request('http://0.0.0.0:3000/api/admin/settings', {
    method: 'POST', headers: { origin: canonical }, body,
  }))).status, 200);
  assert.equal((await post(request({
    origin: 'https://other.example.invalid',
    'x-forwarded-host': 'other.example.invalid',
    host: 'other.example.invalid',
  }))).status, 403);
  assert.equal((await createAdminFormPost(async () => ({ ok: true }), async () => true, null)(request())).status, 200);
});
