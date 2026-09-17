import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_FORM_BODY_LIMIT, createAdminFormPost } from './adminFormRoute';
import { parseAdminFormState, requireSavedService } from '../lib/adminFormState';
import { newerServiceSnapshot, toAdminServiceSnapshot, type AdminServiceSnapshot } from '../lib/adminServiceSnapshot';

const origin = 'http://localhost:3188';
const canonical: AdminServiceSnapshot = {
  id: 'service-owned', name: 'Persisted name', description: '', durationMin: 45,
  priceAgorot: 12345, hidePrice: true, hideDuration: false, hidden: false,
  staff: [{ id: 'staff-owned', displayName: 'Assigned staff', active: true }],
  inUse: true, updatedAt: '2026-09-17T14:00:00.000Z',
};
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

test('edit transport preserves canonical service confirmation and other caller response shapes', async () => {
  const state = { ok: true, mode: 'edit' as const, service: canonical };
  const response = await createAdminFormPost(async () => state, async () => true, origin)(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(requireSavedService(parseAdminFormState(await response.json()), canonical.id), canonical);
  for (const legacy of [{ ok: true }, { ok: true, mode: 'add' }, { ok: true, mode: 'edit' }, { ok: true, scheduled: false }]) {
    assert.deepEqual(parseAdminFormState(legacy), legacy);
  }
  assert.throws(() => requireSavedService({ ok: true, mode: 'edit' }, canonical.id));
  assert.throws(() => requireSavedService(state, 'foreign-service'));
});

test('canonical confirmation rejects malformed, incomplete, private and wrong-mode service payloads', () => {
  for (const service of [
    null, {}, { ...canonical, id: '' }, { ...canonical, name: 1 },
    { ...canonical, description: null }, { ...canonical, durationMin: 0 },
    { ...canonical, durationMin: 1.5 }, { ...canonical, priceAgorot: '12345' },
    { ...canonical, priceAgorot: -1 }, { ...canonical, priceAgorot: Number.MAX_SAFE_INTEGER + 1 },
    { ...canonical, hidden: 'false' }, { ...canonical, hidePrice: null },
    { ...canonical, hideDuration: undefined }, { ...canonical, inUse: 1 },
    { ...canonical, staff: [{ id: 'staff-owned' }] }, { ...canonical, staff: null },
    { ...canonical, updatedAt: 'invalid' }, { ...canonical, businessId: 'private' },
  ]) {
    assert.throws(() => parseAdminFormState({ ok: true, mode: 'edit', service }));
  }
  assert.throws(() => parseAdminFormState({ ok: true, mode: 'add', service: canonical }));
  assert.throws(() => parseAdminFormState({ ok: false, mode: 'edit', service: canonical }));
});

test('service snapshots preserve money, staff, usage and freshness without exposing repository fields', () => {
  const row = {
    ...canonical, description: null, businessId: 'business-owned', sortOrder: 0,
    createdAt: new Date(canonical.updatedAt), updatedAt: new Date(canonical.updatedAt),
    staffLinks: [{
      id: 'link-owned', createdAt: new Date(canonical.updatedAt),
      serviceId: canonical.id, staffId: canonical.staff[0].id, staff: canonical.staff[0],
    }],
    _count: { appointmentServices: 1 },
  };
  assert.deepEqual(toAdminServiceSnapshot(row), canonical);
  assert.equal(toAdminServiceSnapshot({ ...row, description: 'Details', _count: { appointmentServices: 0 } }).inUse, false);
  const newer = { ...canonical, name: 'Newer persisted name', updatedAt: '2026-09-17T14:01:00.000Z' };
  assert.equal(newerServiceSnapshot(canonical, null), canonical);
  assert.equal(newerServiceSnapshot(canonical, newer), newer);
  assert.equal(newerServiceSnapshot(newer, canonical), newer);
  assert.equal(newerServiceSnapshot(canonical, { ...newer, id: 'foreign-service' }), canonical);
  assert.equal(newerServiceSnapshot(canonical, canonical), canonical);
  const refreshedRelationships = {
    ...canonical,
    staff: [{ ...canonical.staff[0], displayName: 'Renamed staff', active: false }],
    inUse: false,
  };
  assert.equal(newerServiceSnapshot(refreshedRelationships, canonical), refreshedRelationships);
  assert.equal(newerServiceSnapshot(canonical, refreshedRelationships), canonical);
});
