import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture, requireIsolatedDatabase } from './fixtures';
import { createAppointment, updateAppointmentStatus } from '../src/server/repos/appointments';
import { bookingPolicy } from '../src/server/booking/policy';
import {
  createHoursException, deleteHoursException, getHoursExceptionConflicts,
  cleanupExpiredHoursExceptions, listHoursExceptions,
} from '../src/server/repos/workingHoursExceptions';
import { formatDateString, formatTime } from '../src/lib/time';
import { normalizeException, MAX_EXCEPTION_RULES } from '../src/lib/workingHoursExceptions';
import { notifyWaitlistEntry, promoteWaitlistEntry } from '../src/server/repos/waitlist';

requireIsolatedDatabase();
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier, context);
  },
});
require('next/dist/server/node-environment-baseline');
const { NextRequest } = require('next/server') as typeof import('next/server');
const { encode } = require('next-auth/jwt') as typeof import('next-auth/jwt');
const { createRequestStoreForAPI } = require('next/dist/server/async-storage/request-store') as typeof import('next/dist/server/async-storage/request-store');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external') as typeof import('next/dist/server/app-render/work-unit-async-storage.external');
const { createWorkStore } = require('next/dist/server/async-storage/work-store') as typeof import('next/dist/server/async-storage/work-store');
const { IncrementalCache } = require('next/dist/server/lib/incremental-cache') as typeof import('next/dist/server/lib/incremental-cache');
const { saveHoursExceptionAction, deleteHoursExceptionAction } = require('../src/app/admin/working-hours/exceptionActions') as typeof import('../src/app/admin/working-hours/exceptionActions');
const { createManualAppointmentAction, setAppointmentStatusAction } = require('../src/app/admin/actions') as typeof import('../src/app/admin/actions');
const { POST: availability } = require('../src/app/api/availability/route') as typeof import('../src/app/api/availability/route');
const { POST: book } = require('../src/app/api/book/route') as typeof import('../src/app/api/book/route');
const { handlePurgeCron } = require('../src/app/api/cron/purge-expired/handler') as typeof import('../src/app/api/cron/purge-expired/handler');
after(() => prisma.$disconnect());

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

async function requestContext<T>(email: string | null, action: () => Promise<T>) {
  const cookie = email ? `authjs.session-token=${await encode({
    token: { email }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
  })}` : '';
  const request = new NextRequest('http://localhost/admin/working-hours', {
    headers: { cookie, host: 'localhost', 'x-forwarded-proto': 'http' },
  });
  const store = createRequestStoreForAPI(request, new URL(request.url),
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined);
  const closeCallbacks: (() => void)[] = [];
  const work = createWorkStore({
    page: '/admin/working-hours/page', buildId: 'integration', previouslyRevalidatedTags: [],
    renderOpts: {
      supportsDynamicResponse: true, isPossibleServerAction: true,
      waitUntil: undefined, onClose: (callback) => closeCallbacks.push(callback),
      onAfterTaskError: undefined,
      experimental: { isRoutePPREnabled: false, cacheComponents: false, authInterrupts: false },
      incrementalCache: new IncrementalCache({
        dev: true, requestHeaders: {}, flushToDisk: false,
        getPrerenderManifest: () => ({
          version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [],
          preview: { previewModeId: 'synthetic', previewModeSigningKey: 'synthetic', previewModeEncryptionKey: 'synthetic' },
        }),
      }),
    },
  });
  try {
    return await workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, action));
  } finally {
    closeCallbacks.forEach((callback) => callback());
  }
}

function ruleInput(f: Awaited<ReturnType<typeof bookingFixture>>) {
  return {
    title: 'Holiday', staffId: null, start: { calendar: 'GREGORIAN' as const, date: formatDateString(f.startAt, f.business.timezone) },
    recurrence: 'ONCE' as const, closed: true, startMinute: null, endMinute: null,
  };
}
function ruleForm(f: Awaited<ReturnType<typeof bookingFixture>>) {
  return form({ title: 'Holiday', staffId: '', calendar: 'GREGORIAN',
    startDate: formatDateString(f.startAt, f.business.timezone), recurrence: 'ONCE', closed: 'on' });
}
function post(path: string, body: object) {
  return new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('owner actions deny anonymous, non-owner, inactive and cross-business employee/rule references', async () => {
  const f = await bookingFixture();
  const other = await bookingFixture();
  try {
    for (const email of [null, 'outsider@example.invalid']) {
      assert.deepEqual(await requestContext(email, () => saveHoursExceptionAction({ ok: false }, ruleForm(f))),
        { ok: false, error: 'forbidden' });
    }
    const foreign = ruleForm(f);
    foreign.set('staffId', other.staff.id);
    assert.deepEqual(await requestContext(f.business.ownerEmail, () => saveHoursExceptionAction({ ok: false }, foreign)),
      { ok: false, error: 'staff' });
    await assert.rejects(prisma.workingHoursException.create({
      data: { businessId: f.business.id, ...normalizeException({ ...ruleInput(f), staffId: other.staff.id }) },
    }), /Foreign key constraint/);
    const otherRule = await createHoursException(other.business.id, ruleInput(other));
    assert.deepEqual(await requestContext(f.business.ownerEmail, () =>
      deleteHoursExceptionAction({ ok: false }, form({ id: otherRule.id }))), { ok: false, error: 'missing' });
    assert.equal(await prisma.workingHoursException.count({ where: { businessId: f.business.id } }), 0);
    await prisma.business.update({ where: { id: f.business.id }, data: { accountStatus: 'PENDING_DELETION' } });
    assert.deepEqual(await requestContext(f.business.ownerEmail, () => saveHoursExceptionAction({ ok: false }, ruleForm(f))),
      { ok: false, error: 'forbidden' });
  } finally {
    await cleanupFixture(f);
    await cleanupFixture(other);
  }
});

test('rule insertion preserves every booking snapshot; public, owner, waitlist and approval respect closure', async () => {
  const f = await bookingFixture();
  try {
    const pending = await createAppointment({ ...f.input, status: 'PENDING' });
    const snapshot = await prisma.appointment.findUniqueOrThrow({
      where: { id: pending.id }, include: { services: true, reminders: true, confirmations: true },
    });
    assert.deepEqual(await requestContext(f.business.ownerEmail, () => saveHoursExceptionAction({ ok: false }, ruleForm(f))), { ok: true });
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({
      where: { id: pending.id }, include: { services: true, reminders: true, confirmations: true },
    }), snapshot);
    const conflicts = await getHoursExceptionConflicts(f.business.id);
    assert.deepEqual(conflicts.conflicts.map((row) => row.id), [pending.id]);
    const date = formatDateString(f.startAt, f.business.timezone);
    const available = await availability(post('/api/availability', {
      slug: f.business.slug, staffId: f.staff.id, serviceIds: [f.service.id], date,
    }));
    assert.equal(available.status, 200);
    assert.deepEqual((await available.json()).slots, []);
    const nextStart = new Date(f.startAt.getTime() + 3_600_000);
    const publicResult = await requestContext(null, () => book(post('/api/book', {
      slug: f.business.slug, staffId: f.staff.id, serviceIds: [f.service.id], startAtUtc: nextStart.toISOString(),
      name: 'Synthetic guest', phone: '0501234567', email: 'synthetic@example.invalid',
    })));
    assert.equal(publicResult.status, 409);
    assert.equal((await publicResult.json()).error, 'slot_unavailable');
    const ownerResult = await requestContext(f.business.ownerEmail, () => createManualAppointmentAction({ ok: false }, form({
      staffId: f.staff.id, serviceId: f.service.id, date, time: formatTime(nextStart, f.business.timezone),
      clientName: 'Synthetic guest', clientPhone: '0501234567',
    })));
    assert.deepEqual(ownerResult, { ok: false, error: 'slot_unavailable' });
    assert.deepEqual(await requestContext(f.business.ownerEmail, () =>
      setAppointmentStatusAction(pending.id, 'CONFIRMED')), { ok: false });
    await assert.rejects(updateAppointmentStatus(pending.id, 'CONFIRMED', { businessId: f.business.id }), /slot_unavailable/);
    const entry = await prisma.waitlistEntry.create({ data: {
      businessId: f.business.id, staffId: f.staff.id, serviceId: f.service.id,
      desiredDate: date, name: 'Synthetic waitlist', phone: '0501234567', email: 'waitlist@example.invalid',
    } });
    assert.deepEqual(await notifyWaitlistEntry(f.business.id, entry.id, {
      emailConfigured: true, sendEmail: async () => { throw new Error('provider must not be invoked'); },
    }), { ok: false, reason: 'no_availability' });
    assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status, 'WAITING');
    // The legacy manual marker records an externally arranged booking; it never creates a slot.
    assert.equal(await promoteWaitlistEntry(f.business.id, entry.id), true);
    assert.equal(await prisma.appointment.count({ where: { businessId: f.business.id } }), 1);
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({
      where: { id: pending.id }, include: { services: true, reminders: true, confirmations: true },
    }), snapshot);
    const rule = await prisma.workingHoursException.findFirstOrThrow({ where: { businessId: f.business.id } });
    await deleteHoursException(f.business.id, rule.id);
    assert.equal((await updateAppointmentStatus(pending.id, 'CONFIRMED', { businessId: f.business.id }))?.status, 'CONFIRMED');
  } finally { await cleanupFixture(f); }
});

test('alternative hours replace inherited schedules and staff exceptions remain employee-scoped', async () => {
  const f = await bookingFixture();
  try {
    const otherUser = await prisma.user.create({ data: { name: 'Second employee' } });
    const otherStaff = await prisma.staffMember.create({
      data: { businessId: f.business.id, userId: otherUser.id, displayName: 'Second employee',
        serviceLinks: { create: { serviceId: f.service.id } } },
    });
    try {
      const date = formatDateString(f.startAt, f.business.timezone);
      await createHoursException(f.business.id, {
        ...ruleInput(f), staffId: f.staff.id, closed: false, startMinute: 600, endMinute: 660,
      });
      await assert.rejects(createAppointment(f.input), /slot_unavailable/);
      const policy = await bookingPolicy(f.business.id, f.staff.id, [f.service.id], date);
      assert.deepEqual(policy.slots.map((slot) => slot.label), ['10:00', '10:30']);
      const otherPolicy = await bookingPolicy(f.business.id, otherStaff.id, [f.service.id], date);
      assert.ok(otherPolicy.slots.some((slot) => slot.label === '09:00'));
      await createHoursException(f.business.id, ruleInput(f));
      assert.deepEqual((await bookingPolicy(f.business.id, f.staff.id, [f.service.id], date)).slots, []);
      assert.deepEqual((await bookingPolicy(f.business.id, otherStaff.id, [f.service.id], date)).slots, []);
    } finally {
      await prisma.staffMember.delete({ where: { id: otherStaff.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  } finally { await cleanupFixture(f); }
});

test('cleanup expires only one-off definitions after local date, with DST and timezone separation', async () => {
  const west = await bookingFixture();
  const east = await bookingFixture();
  try {
    const snapshot = await createAppointment(west.input);
    const appointmentBefore = await prisma.appointment.findUniqueOrThrow({ where: { id: snapshot.id }, include: { reminders: true, services: true } });
    await prisma.business.update({ where: { id: west.business.id }, data: { timezone: 'America/New_York' } });
    await prisma.business.update({ where: { id: east.business.id }, data: { timezone: 'Asia/Tokyo' } });
    for (const f of [west, east]) {
      for (const recurrence of ['ONCE', 'ANNUAL'] as const) {
        await prisma.workingHoursException.create({ data: {
          businessId: f.business.id, ...normalizeException({
            ...ruleInput(f), start: { calendar: 'GREGORIAN', date: '2026-11-01' }, recurrence,
          }),
        } });
      }
    }
    const now = new Date('2026-11-02T04:30:00Z'); // NY is still November 1 after DST fall-back.
    assert.equal((await listHoursExceptions(west.business.id, prisma, now)).length, 2);
    assert.equal((await listHoursExceptions(east.business.id, prisma, now)).length, 1);
    await cleanupExpiredHoursExceptions(now);
    assert.equal(await prisma.workingHoursException.count({ where: { businessId: west.business.id } }), 2);
    assert.equal(await prisma.workingHoursException.count({ where: { businessId: east.business.id } }), 1);
    await cleanupExpiredHoursExceptions(new Date('2026-11-02T05:00:00Z'));
    assert.equal(await prisma.workingHoursException.count({ where: { businessId: west.business.id } }), 1);
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({ where: { id: snapshot.id }, include: { reminders: true, services: true } }), appointmentBefore);
  } finally {
    await cleanupFixture(west);
    await cleanupFixture(east);
  }
});

test('concurrent rule quota writes persist at most 200 and closure wins after commit', async () => {
  const f = await bookingFixture();
  try {
    await prisma.workingHoursException.createMany({
      data: Array.from({ length: MAX_EXCEPTION_RULES - 1 }, () => ({
        businessId: f.business.id, ...normalizeException({ ...ruleInput(f), recurrence: 'ANNUAL' }),
      })),
    });
    const results = await Promise.allSettled([
      createHoursException(f.business.id, ruleInput(f)), createHoursException(f.business.id, ruleInput(f)),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(await prisma.workingHoursException.count({ where: { businessId: f.business.id } }), MAX_EXCEPTION_RULES);
    await assert.rejects(createAppointment(f.input), /slot_unavailable/);
  } finally { await cleanupFixture(f); }
});

test('concurrent booking and closure serialize, preserve any admitted reservation, and block later admissions', async () => {
  const f = await bookingFixture();
  try {
    const [booking, closure] = await Promise.allSettled([
      createAppointment(f.input), createHoursException(f.business.id, ruleInput(f)),
    ]);
    assert.equal(closure.status, 'fulfilled');
    if (booking.status === 'fulfilled') {
      const persisted = await prisma.appointment.findUniqueOrThrow({ where: { id: booking.value.id } });
      assert.equal(persisted.startAt.getTime(), f.startAt.getTime());
      assert.equal(persisted.status, booking.value.status);
      assert.equal((await getHoursExceptionConflicts(f.business.id)).conflicts.length, 1);
    } else assert.match(String(booking.reason), /slot_unavailable/);
    await assert.rejects(createAppointment({ ...f.input, startAt: new Date(f.startAt.getTime() + 3_600_000) }), /slot_unavailable/);
  } finally { await cleanupFixture(f); }
});

test('additive migration replays with exact booking data and no deletion side effects', async () => {
  const f = await bookingFixture();
  try {
    const appointment = await createAppointment(f.input);
    const before = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: { services: true, reminders: true } });
    const sql = readFileSync('prisma/migrations/20260913000000_working_hours_exceptions/migration.sql', 'utf8');
    // Prisma's raw protocol cannot execute multiple SQL commands; psql replays the file in the release migration gate.
    assert.match(sql, /CREATE TABLE IF NOT EXISTS/);
    const { execFileSync } = await import('node:child_process');
    const pg = process.env.TEST_PG_BIN ? `${process.env.TEST_PG_BIN}/psql`
      : existsSync('/opt/homebrew/opt/postgresql@14/bin/psql') ? '/opt/homebrew/opt/postgresql@14/bin/psql' : 'psql';
    execFileSync(pg, [
      process.env.TEST_DATABASE_URL!.replace('?schema=public', ''), '-v', 'ON_ERROR_STOP=1', '-f',
      'prisma/migrations/20260913000000_working_hours_exceptions/migration.sql',
    ], { stdio: 'pipe' });
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: { services: true, reminders: true } }), before);
  } finally { await cleanupFixture(f); }
});

test('cleanup scheduler is authenticated and opt-in, including disabled default', async () => {
  const previous = { secret: process.env.CRON_SECRET, enabled: process.env.HOURS_EXCEPTION_CLEANUP_ENABLED };
  let called = 0;
  const deps = {
    cleanupExpiredHoursExceptions: async () => { called++; return 3; },
    purgeExpiredBusinesses: async () => ({ purgedBusinessIds: [] }),
  };
  try {
    process.env.CRON_SECRET = 'synthetic-only';
    delete process.env.HOURS_EXCEPTION_CLEANUP_ENABLED;
    assert.equal((await handlePurgeCron(new Request('http://localhost/api/cron/purge-expired'), deps)).status, 401);
    const request = () => new Request('http://localhost/api/cron/purge-expired', { headers: { 'x-cron-secret': 'synthetic-only' } });
    assert.equal((await handlePurgeCron(request(), deps)).status, 200);
    assert.equal(called, 0);
    process.env.HOURS_EXCEPTION_CLEANUP_ENABLED = 'true';
    assert.equal((await (await handlePurgeCron(request(), deps)).json()).expiredExceptions, 3);
    assert.equal(called, 1);
  } finally {
    for (const [key, value] of [['CRON_SECRET', previous.secret], ['HOURS_EXCEPTION_CLEANUP_ENABLED', previous.enabled]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  }
});
