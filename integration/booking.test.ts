import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { prisma } from '../src/lib/db';
import {
  createAppointment,
  updateAppointmentStatus,
} from '../src/server/repos/appointments';
import { bookingPolicy, expirePendingReservations } from '../src/server/booking/policy';
import { formatDateString } from '../src/lib/time';
import { bookingFixture, cleanupFixture, requireIsolatedDatabase } from './fixtures';
import { encryptToken } from '../src/lib/tokenCrypto';
import {
  captureGoogleBusy,
  assertGoogleBusySnapshot,
} from '../src/server/google/importBusy';

requireIsolatedDatabase();
// Use the same server-only alias as the production Next bundle, without mocking repositories.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    );
  },
});
const { POST: availabilityHandler } =
  require('../src/app/api/availability/route') as typeof import('../src/app/api/availability/route');
after(() => prisma.$disconnect());

test('concurrent actual repository commits persist one overlap and one reminder', async () => {
  const f = await bookingFixture();
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => createAppointment(f.input)),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      1,
    );
    assert.equal(
      await prisma.reminder.count({
        where: { appointment: { businessId: f.business.id } },
      }),
      1,
    );
    const appt = await prisma.appointment.findFirstOrThrow({
      where: { businessId: f.business.id },
      include: { services: true },
    });
    assert.equal(appt.totalPriceAgorot, f.service.priceAgorot);
    assert.equal(appt.services[0].durationMinSnapshot, f.service.durationMin);
  } finally {
    await cleanupFixture(f);
  }
});

test('database exclusion also protects direct writes and ARRIVED', async () => {
  const f = await bookingFixture();
  try {
    const appt = await createAppointment(f.input);
    await updateAppointmentStatus(appt.id, 'ARRIVED', { businessId: f.business.id });
    await assert.rejects(
      prisma.appointment.create({
        data: {
          businessId: f.business.id,
          staffId: f.staff.id,
          clientId: f.client.id,
          startAt: f.startAt,
          endAt: f.input.endAt,
          status: 'CONFIRMED',
        },
      }),
    );
    const availability = await bookingPolicy(
      f.business.id,
      f.staff.id,
      [f.service.id],
      formatDateString(f.startAt, f.business.timezone),
    );
    assert.equal(
      availability.slots.some((slot) => slot.startAtUtc === f.startAt.toISOString()),
      false,
    );
  } finally {
    await cleanupFixture(f);
  }
});

test('hours, breaks, staff overrides, assignment, lead and horizon are authoritative at commit', async () => {
  const f = await bookingFixture();
  try {
    await assert.rejects(
      createAppointment({
        ...f.input,
        startAt: new Date(f.startAt.getTime() - 6 * 3_600_000),
      }),
      /slot_unavailable/,
    );
    await assert.rejects(
      createAppointment({
        ...f.input,
        startAt: new Date(f.startAt.getTime() + 3 * 3_600_000),
      }),
      /slot_unavailable/,
    );
    await prisma.businessSettings.update({
      where: { businessId: f.business.id },
      data: { minLeadTimeMinutes: 20_000 },
    });
    await assert.rejects(createAppointment(f.input), /slot_unavailable/);
    await prisma.businessSettings.update({
      where: { businessId: f.business.id },
      data: { minLeadTimeMinutes: 0, maxAdvanceBookingDays: 1 },
    });
    await assert.rejects(createAppointment(f.input), /slot_unavailable/);
    await prisma.businessSettings.update({
      where: { businessId: f.business.id },
      data: { maxAdvanceBookingDays: 30 },
    });
    await prisma.workingHours.create({
      data: {
        scope: 'STAFF',
        staffId: f.staff.id,
        weekday: new Date(formatDateString(f.startAt, f.business.timezone)).getUTCDay(),
        startMinute: 14 * 60,
        endMinute: 17 * 60,
      },
    });
    await assert.rejects(createAppointment(f.input), /slot_unavailable/);
    await prisma.serviceStaff.deleteMany({ where: { staffId: f.staff.id } });
    await assert.rejects(createAppointment(f.input), /staff_service_mismatch/);
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      0,
    );
  } finally {
    await cleanupFixture(f);
  }
});

test('stale approvals and terminal status changes cannot resurrect cancellation', async () => {
  const f = await bookingFixture();
  try {
    const appt = await createAppointment({ ...f.input, status: 'PENDING' });
    await updateAppointmentStatus(appt.id, 'CANCELLED', { businessId: f.business.id });
    assert.equal(
      await updateAppointmentStatus(appt.id, 'CONFIRMED', {
        businessId: f.business.id,
        expectedStatus: 'PENDING',
      }),
      null,
    );
    assert.equal(
      await updateAppointmentStatus(appt.id, 'ARRIVED', { businessId: f.business.id }),
      null,
    );
    await assert.rejects(
      updateAppointmentStatus(appt.id, 'CONFIRMED', { businessId: 'wrong-tenant' }),
      /forbidden/,
    );
    assert.equal(
      (await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status,
      'CANCELLED',
    );
  } finally {
    await cleanupFixture(f);
  }
});

test('approval preserves a reservation inside changed lead time and after the admission grid shifts', async () => {
  const f = await bookingFixture();
  try {
    await prisma.service.update({
      where: { id: f.service.id },
      data: { durationMin: 15 },
    });
    const early = await createAppointment(f.input);
    await prisma.service.update({
      where: { id: f.service.id },
      data: { durationMin: 30 },
    });
    const startAt = new Date(f.startAt.getTime() + 45 * 60_000);
    const pending = await createAppointment({ ...f.input, startAt, status: 'PENDING' });
    await updateAppointmentStatus(early.id, 'CANCELLED', { businessId: f.business.id });
    await prisma.businessSettings.update({
      where: { businessId: f.business.id },
      data: { minLeadTimeMinutes: 20_000 },
    });
    const policy = await bookingPolicy(
      f.business.id,
      f.staff.id,
      [f.service.id],
      formatDateString(startAt, f.business.timezone),
    );
    assert.equal(
      policy.slots.some((slot) => slot.startAtUtc === startAt.toISOString()),
      false,
    );
    const approved = await updateAppointmentStatus(pending.id, 'CONFIRMED', {
      businessId: f.business.id,
      expectedStatus: 'PENDING',
    });
    assert.equal(approved?.status, 'CONFIRMED');
    assert.equal(approved?.startAt.getTime(), startAt.getTime());
    assert.equal(approved?.endAt.getTime(), pending.endAt.getTime());
  } finally {
    await cleanupFixture(f);
  }
});

test('external busy is enforced at commit with bounded fresh snapshots and fail-closed provider errors', async (context) => {
  const f = await bookingFixture();
  const keys = [
    'GOOGLE_CALENDAR_SYNC_ENABLED',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    process.env[key] = key === 'GOOGLE_CALENDAR_SYNC_ENABLED' ? 'true' : 'synthetic';
  });
  let mode: 'busy' | 'failed' | 'invalid' | 'clear' | 'changed' = 'busy';
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    assert.equal(String(input), 'https://www.googleapis.com/calendar/v3/freeBusy');
    calls++;
    if (mode === 'failed') throw new Error('synthetic timeout');
    if (mode === 'changed')
      await prisma.staffCalendarConnection.update({
        where: { staffId: f.staff.id },
        data: { importBusy: false },
      });
    return Response.json({
      calendars: {
        primary:
          mode === 'invalid'
            ? { errors: [{ reason: 'forbidden' }] }
            : {
                busy:
                  mode === 'busy'
                    ? [
                        {
                          start: f.startAt.toISOString(),
                          end: f.input.endAt.toISOString(),
                        },
                      ]
                    : [],
              },
      },
    });
  });
  try {
    await prisma.staffCalendarConnection.create({
      data: {
        businessId: f.business.id,
        staffId: f.staff.id,
        calendarId: 'primary',
        accessTokenEnc: encryptToken('synthetic-access'),
        refreshTokenEnc: encryptToken('synthetic-refresh'),
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        importBusy: true,
        exportBookings: false,
      },
    });
    const request = () =>
      new Request('http://localhost/api/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: f.business.slug,
          staffId: f.staff.id,
          serviceIds: [f.service.id],
          date: formatDateString(f.startAt, f.business.timezone),
        }),
      });
    const available = await availabilityHandler(request());
    assert.equal(available.status, 200);
    assert.equal(
      (await available.json()).slots.some(
        (slot: { startAtUtc: string }) => slot.startAtUtc === f.startAt.toISOString(),
      ),
      false,
    );
    await assert.rejects(createAppointment(f.input), /slot_taken/);
    mode = 'failed';
    assert.equal((await availabilityHandler(request())).status, 503);
    await assert.rejects(createAppointment(f.input), /calendar_unavailable/);
    mode = 'invalid';
    await assert.rejects(createAppointment(f.input), /calendar_unavailable/);
    mode = 'changed';
    await assert.rejects(createAppointment(f.input), /calendar_snapshot_stale/);
    await prisma.staffCalendarConnection.update({
      where: { staffId: f.staff.id },
      data: { importBusy: true },
    });
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      0,
    );
    mode = 'clear';
    const snapshot = await captureGoogleBusy(
      f.business.id,
      f.staff.id,
      f.startAt,
      f.input.endAt,
    );
    snapshot.checkedAt -= 31_000;
    await assert.rejects(
      prisma.$transaction((db) =>
        assertGoogleBusySnapshot(snapshot, db, f.startAt, f.input.endAt),
      ),
      /calendar_snapshot_stale/,
    );
    const input = {
      ...f.input,
      idempotency: {
        scope: f.business.id,
        key: randomUUID(),
        requestHash: 'google-clear',
      },
    };
    const booked = await createAppointment(input);
    mode = 'failed';
    const callsBeforeReplay = calls;
    assert.equal((await createAppointment(input)).id, booked.id);
    assert.equal(calls, callsBeforeReplay);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    await cleanupFixture(f);
  }
});

test('scoped idempotency replays success under concurrency and rejects changed payload', async () => {
  const f = await bookingFixture();
  try {
    const idempotency = {
      scope: f.business.id,
      key: randomUUID(),
      requestHash: 'fixed-request',
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => createAppointment({ ...f.input, idempotency })),
    );
    assert.equal(new Set(results.map((result) => result.id)).size, 1);
    assert.equal(results.filter((result) => !result.replayed).length, 1);
    await assert.rejects(
      createAppointment({
        ...f.input,
        idempotency: { ...idempotency, requestHash: 'changed' },
      }),
      /idempotency_mismatch/,
    );
    assert.equal(
      await prisma.reminder.count({
        where: { appointment: { businessId: f.business.id } },
      }),
      1,
    );
  } finally {
    await cleanupFixture(f);
  }
});

test('reminder persistence failure rolls back the appointment and retry succeeds', async () => {
  const f = await bookingFixture();
  try {
    // A transaction-local SQL trigger fails only this fixture's reminder insert.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_fail_reminder() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF EXISTS (SELECT 1 FROM "Appointment" WHERE id=NEW."appointmentId" AND "businessId"='${f.business.id}')
      THEN RAISE EXCEPTION 'synthetic reminder failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER test_fail_reminder BEFORE INSERT ON "Reminder" FOR EACH ROW EXECUTE FUNCTION test_fail_reminder()',
    );
    await assert.rejects(createAppointment(f.input), /synthetic reminder failure/);
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      0,
    );
    await prisma.$executeRawUnsafe('DROP TRIGGER test_fail_reminder ON "Reminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_fail_reminder()');
    await createAppointment(f.input);
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      1,
    );
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS test_fail_reminder ON "Reminder"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_reminder()');
    await cleanupFixture(f);
  }
});

test('expired pending reservations free inventory and cannot be approved', async () => {
  const f = await bookingFixture();
  try {
    const appt = await createAppointment({ ...f.input, status: 'PENDING' });
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { pendingExpiresAt: new Date(0) },
    });
    assert.equal(
      await updateAppointmentStatus(appt.id, 'CONFIRMED', { businessId: f.business.id }),
      null,
    );
    assert.equal((await expirePendingReservations(f.business.id)).count, 1);
    await createAppointment(f.input);
  } finally {
    await cleanupFixture(f);
  }
});

test('actual HTTP booking route rejects malformed contacts and unassigned service, then replays valid booking', async () => {
  const f = await bookingFixture();
  const base = process.env.E2E_BASE_URL;
  assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  try {
    const payload = {
      slug: f.business.slug,
      staffId: f.staff.id,
      serviceIds: [f.service.id],
      startAtUtc: f.startAt.toISOString(),
      name: 'HTTP synthetic guest',
      phone: '0509786111',
      email: 'http-test@example.invalid',
    };
    const post = async (data: object, key = randomUUID()) => {
      const response = await fetch(`${base}/api/book`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(data),
      });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await post({ ...payload, phone: '123' })).status, 400);
    assert.equal((await post({ ...payload, email: 'invalid' })).status, 400);
    assert.equal(await prisma.client.count({ where: { businessId: f.business.id } }), 1);
    await prisma.serviceStaff.deleteMany({
      where: { staffId: f.staff.id, serviceId: f.service.id },
    });
    assert.equal((await post(payload)).status, 400);
    await prisma.serviceStaff.create({
      data: { staffId: f.staff.id, serviceId: f.service.id },
    });
    const key = randomUUID();
    const first = await post(payload, key);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const retry = await post(payload, key);
    assert.equal(retry.status, 200);
    assert.equal(first.body.appointmentId, retry.body.appointmentId);
    const withoutKey = await fetch(`${base}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(
      withoutKey.status,
      409,
      'contact details alone cannot replay another guest receipt',
    );
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      1,
    );
  } finally {
    await cleanupFixture(f);
  }
});

test('successful public bookings consume distributed quotas once and denied bookings roll back guest records', async () => {
  const f = await bookingFixture();
  try {
    const source = randomUUID();
    const email = `${randomUUID()}@example.invalid`;
    for (let index = 0; index < 5; index++) {
      const idempotency = {
        scope: f.business.id,
        key: randomUUID(),
        requestHash: String(index),
      };
      const input = {
        ...f.input,
        clientIdentity: { name: 'Quota guest', email },
        startAt: new Date(f.startAt.getTime() + index * 30 * 60_000),
        source,
        publicBooking: true,
        idempotency,
      };
      const appointment = await createAppointment(input);
      assert.equal(appointment.replayed, false);
      assert.equal((await createAppointment(input)).replayed, true);
    }
    await assert.rejects(
      createAppointment({
        ...f.input,
        clientIdentity: { name: 'Quota guest', email },
        startAt: new Date(f.startAt.getTime() + 5 * 30 * 60_000),
        source,
        publicBooking: true,
      }),
      /booking_quota_exceeded/,
    );
    assert.equal(
      await prisma.appointment.count({ where: { businessId: f.business.id } }),
      5,
    );
    assert.equal(
      await prisma.client.count({ where: { businessId: f.business.id, email } }),
      5,
    );
  } finally {
    await cleanupFixture(f);
  }
});
