import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import { historyPageSchema } from '../src/lib/appointmentHistory';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

assert.ok(process.env.TEST_DATABASE_URL, 'Disposable TEST_DATABASE_URL required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'synthetic-history-integration-secret';
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    );
  },
});
require('next/dist/server/node-environment-baseline');
const { prisma } = require('../src/lib/db') as typeof import('../src/lib/db');
const { bookingFixture, cleanupFixture, requireIsolatedDatabase } =
  require('./fixtures') as typeof import('./fixtures');
const { serializeSession } =
  require('../src/lib/session') as typeof import('../src/lib/session');
const { GET: history } =
  require('../src/app/api/public/b/[slug]/history/route') as typeof import('../src/app/api/public/b/[slug]/history/route');
const { GET: returning } =
  require('../src/app/api/public/b/[slug]/returning/route') as typeof import('../src/app/api/public/b/[slug]/returning/route');
const { NextRequest } = require('next/server') as typeof import('next/server');
const { createRequestStoreForAPI } =
  require('next/dist/server/async-storage/request-store') as typeof import('next/dist/server/async-storage/request-store');
const { workAsyncStorage } =
  require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { workUnitAsyncStorage } =
  require('next/dist/server/app-render/work-unit-async-storage.external') as typeof import('next/dist/server/app-render/work-unit-async-storage.external');
requireIsolatedDatabase();
let fixture: Awaited<ReturnType<typeof bookingFixture>>;
let other: Awaited<ReturnType<typeof bookingFixture>>;
let customerId: string;

async function request(
  slug: string,
  userId: string | null,
  query = '',
  upcoming = false,
) {
  const path = `/api/public/b/${slug}/${upcoming ? 'returning' : 'history'}${query}`;
  const cookie = userId
    ? `client_session=${serializeSession({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })}`
    : '';
  const req = new NextRequest(`http://localhost${path}`, {
    headers: { host: 'localhost', cookie },
  });
  const store = createRequestStoreForAPI(
    req,
    new URL(req.url),
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
  );
  const work = {
    isStaticGeneration: false,
    route: path,
    incrementalCache: {},
    pendingRevalidatedTags: [],
  } as unknown as WorkStore;
  return workAsyncStorage.run(work, () =>
    workUnitAsyncStorage.run(store, () =>
      (upcoming ? returning : history)(req, { params: Promise.resolve({ slug }) }),
    ),
  );
}

before(async () => {
  fixture = await bookingFixture();
  other = await bookingFixture();
  const customer = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  customerId = customer.id;
  await prisma.client.update({
    where: { id: fixture.client.id },
    data: { userId: customerId, identityVerifiedAt: new Date() },
  });
  for (let i = 0; i < 25; i++) {
    await prisma.appointment.create({
      data: {
        businessId: fixture.business.id,
        staffId: fixture.staff.id,
        clientId: fixture.client.id,
        startAt: new Date('2026-01-01T10:00:00Z'),
        endAt: new Date('2026-01-01T10:30:00Z'),
        status: i === 0 ? 'DONE' : 'CANCELLED',
        totalPriceAgorot: 25000,
        services: {
          create: {
            serviceId: fixture.service.id,
            nameSnapshot: 'Historical name',
            durationMinSnapshot: 30,
            priceAgorotSnapshot: 25000,
          },
        },
      },
    });
  }
  await prisma.service.update({
    where: { id: fixture.service.id },
    data: { name: 'Changed current name', priceAgorot: 99999 },
  });
});

after(async () => {
  if (fixture) await cleanupFixture(fixture);
  if (other) await cleanupFixture(other);
  if (customerId) await prisma.user.delete({ where: { id: customerId } });
  await prisma.$disconnect();
});

test('history pages enforce verified ownership, business scope, snapshots and tied-date pagination', async () => {
  const response = await request(fixture.business.slug, customerId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  const first = historyPageSchema.parse(await response.json());
  assert.equal(first.appointments.length, 20);
  assert.equal(first.appointments[0].title, 'Historical name');
  assert.equal(first.appointments[0].bookedPriceAgorot, 25000);
  assert.equal(first.appointments[0].paidAgorot, null);
  assert.ok(first.nextCursor);
  const query = new URLSearchParams({
    before: first.nextCursor.startAt,
    beforeId: first.nextCursor.id,
  });
  const second = historyPageSchema.parse(
    await (await request(fixture.business.slug, customerId, `?${query}`)).json(),
  );
  assert.equal(second.appointments.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(
    new Set([...first.appointments, ...second.appointments].map((a) => a.id)).size,
    25,
  );
  assert.deepEqual(
    (await (await request(other.business.slug, customerId)).json()).appointments,
    [],
  );
  assert.deepEqual(
    (await (await request(fixture.business.slug, other.staff.userId)).json())
      .appointments,
    [],
  );
  await prisma.client.update({
    where: { id: fixture.client.id },
    data: { identityVerifiedAt: null },
  });
  assert.deepEqual(
    (await (await request(fixture.business.slug, customerId)).json()).appointments,
    [],
  );
  await prisma.client.update({
    where: { id: fixture.client.id },
    data: { identityVerifiedAt: new Date() },
  });
});

test('guest IDs, bad cursors and missing businesses never reveal history or permit caching', async () => {
  for (const [slug, user, query, status] of [
    [fixture.business.slug, null, '?booked=anything', 401],
    [fixture.business.slug, customerId, '?before=invalid&beforeId=anything', 400],
    [fixture.business.slug, customerId, '?beforeId=anything', 400],
    ['missing-history-business', customerId, '', 404],
  ] as const) {
    const response = await request(slug, user, query);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.ok(!JSON.stringify(await response.json()).includes('Historical name'));
  }
});

test('customers with only history still receive the returning section', async () => {
  const response = await request(fixture.business.slug, customerId, '', true);
  const body = await response.json();
  assert.equal(body.mode, 'returning');
  assert.deepEqual(body.appointments, []);
});

test('future cancelled appointments stay out of past history', async () => {
  const future = await prisma.appointment.create({
    data: {
      businessId: fixture.business.id,
      staffId: fixture.staff.id,
      clientId: fixture.client.id,
      startAt: fixture.startAt,
      endAt: new Date(fixture.startAt.getTime() + 1800000),
      status: 'CANCELLED',
      totalPriceAgorot: 5000,
    },
  });
  const response = historyPageSchema.parse(
    await (await request(fixture.business.slug, customerId)).json(),
  );
  assert.ok(!response.appointments.some((a) => a.id === future.id));
});

test('recorded payment attribution survives current price changes and hides private references and credits', async () => {
  const appointment = await prisma.appointment.create({
    data: {
      businessId: fixture.business.id,
      staffId: fixture.staff.id,
      clientId: fixture.client.id,
      startAt: new Date('2026-01-02T10:00:00Z'),
      endAt: new Date('2026-01-02T10:30:00Z'),
      status: 'DONE',
      totalPriceAgorot: 25000,
      notes: 'private appointment note',
      services: {
        create: {
          serviceId: fixture.service.id,
          nameSnapshot: 'Paid historical service',
          durationMinSnapshot: 30,
          priceAgorotSnapshot: 25000,
        },
      },
    },
  });
  const sale = await prisma.sale.create({
    data: {
      businessId: fixture.business.id,
      clientId: fixture.client.id,
      appointmentId: appointment.id,
      status: 'COMPLETED',
      subtotalAgorot: 25000,
      discountAgorot: 3000,
      totalAgorot: 22000,
      paidAgorot: 22000,
      note: 'private sale note',
      items: {
        create: {
          kind: 'SERVICE',
          serviceId: fixture.service.id,
          nameSnapshot: 'Sale service',
          quantity: 1,
          unitPriceAgorot: 25000,
          lineTotalAgorot: 25000,
        },
      },
      payments: {
        create: [
          { amountAgorot: 12000, reference: 'private payment reference' },
          { amountAgorot: 10000 },
        ],
      },
    },
  });
  const body = await (await request(fixture.business.slug, customerId)).text();
  const page = historyPageSchema.parse(JSON.parse(body));
  assert.equal(page.appointments[0].id, appointment.id);
  assert.equal(page.appointments[0].paidAgorot, 22000);
  assert.equal(page.appointments[0].bookedPriceAgorot, 25000);
  assert.ok(!body.includes('private'));
  const original = await prisma.document.create({
    data: {
      businessId: fixture.business.id,
      saleId: sale.id,
      type: 'RECEIPT',
      serialNumber: 1,
      documentNumber: 'synthetic-receipt',
      subtotalAgorot: 22000,
      vatAgorot: 0,
      totalAgorot: 22000,
    },
  });
  await prisma.document.create({
    data: {
      businessId: fixture.business.id,
      relatedDocumentId: original.id,
      type: 'CREDIT_NOTE',
      serialNumber: 1,
      documentNumber: 'synthetic-credit',
      subtotalAgorot: 22000,
      vatAgorot: 0,
      totalAgorot: 22000,
    },
  });
  const credited = historyPageSchema.parse(
    await (await request(fixture.business.slug, customerId)).json(),
  );
  assert.equal(credited.appointments[0].paidAgorot, null);
});
