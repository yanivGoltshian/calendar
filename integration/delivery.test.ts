import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, Business, Client, StaffMember } from '@prisma/client';
import type { insertEvent } from '../src/server/google/calendarClient';
import type { EmailDeliveryDeps } from '../src/server/billing/emailDelivery';

assert.ok(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must be a disposable migrated database');
const database = new URL(process.env.TEST_DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', 'postgres'].includes(database.hostname) &&
  database.pathname.startsWith('/torchick_test'), 'Refusing a non-isolated test database');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CRON_SECRET = 'delivery-integration-secret';
delete process.env.EMAIL_SERVER;
delete process.env.EMAIL_FROM;
delete process.env.GOOGLE_CALENDAR_SYNC_ENABLED;

const { prisma } = require('../src/lib/db') as { prisma: PrismaClient };
const { sendGuardedSms } = require('../src/server/billing/costGuard') as typeof import('../src/server/billing/costGuard');
const { deliverEmailOnce } = require('../src/server/billing/emailDelivery') as typeof import('../src/server/billing/emailDelivery');
const { canDeliverClientEmail } = require('../src/server/billing/deliveryPolicy') as typeof import('../src/server/billing/deliveryPolicy');
const { notifyClientOfBooking } = require('../src/server/notifications/bookingConfirmation') as typeof import('../src/server/notifications/bookingConfirmation');
const { notifyWaitlistEntry, cancelWaitlistEntry } = require('../src/server/repos/waitlist') as typeof import('../src/server/repos/waitlist');
const { sendCampaign } = require('../src/server/repos/marketing') as typeof import('../src/server/repos/marketing');
const { handleReminderCron, defaultReminderDeps } = require('../src/app/api/cron/reminders/handler') as typeof import('../src/app/api/cron/reminders/handler');
const { sendReminder, prepareReminder } = require('../src/server/reminders/send') as typeof import('../src/server/reminders/send');
const { claimReminder, beginReminderDispatch, releaseReminder } = require('../src/server/reminders/reminderClaims') as typeof import('../src/server/reminders/reminderClaims');
const { reconcileAppointmentCalendar, appointmentGoogleEventId } = require('../src/server/google/appointmentSync') as typeof import('../src/server/google/appointmentSync');

const prefix = `delivery-${randomUUID()}`;
const userIds: string[] = [];
let business: Business;
let staff: StaffMember;
let client: Client;
let apptNumber = 0;
const config = { capAgorot: 4500, alertAgorot: 4000, unitCostAgorot: 10 };
const noop = async () => undefined;
const later = () => new Date(Date.now() + 30 * 86400000);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function appointment(options: { withIntent?: boolean; startAt?: Date } = {}) {
  const startAt = options.startAt ?? new Date(Date.now() + (++apptNumber) * 3600000);
  return prisma.appointment.create({
    data: {
      businessId: business.id, clientId: client.id, staffId: staff.id,
      status: 'CONFIRMED', startAt, endAt: new Date(startAt.getTime() + 1800000),
      googleSyncPending: true,
      reminders: options.withIntent === false ? undefined
        : { create: { sendAt: new Date(Date.now() - 60000), channel: 'EMAIL' } },
    },
  });
}
function paid(key: string) {
  return { businessId: business.id, clientId: client.id, to: client.phone!, body: 'Test message', idempotencyKey: key };
}
async function reset() {
  await prisma.messageLog.deleteMany({ where: { businessId: business.id } });
  await prisma.business.update({ where: { id: business.id }, data: { accountStatus: 'ACTIVE', plan: 'exclusive', paidUntil: later() } });
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { remindersEnabled: true, reminderLeadHours: 168 } });
}

function reminderRequest() {
  return new Request('http://localhost/api/cron/reminders', { headers: { 'x-cron-secret': process.env.CRON_SECRET! } });
}
function reminderWorker(id: string, prepare: typeof prepareReminder) {
  return {
    ...defaultReminderDeps, prepareReminder: prepare, reconcilePendingCalendars: undefined,
    getAppointmentsDueForReminder: async (start: Date, end: Date) =>
      (await defaultReminderDeps.getAppointmentsDueForReminder(start, end)).filter((row) => row.id === id),
  };
}

before(async () => {
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test`, phone: `+97250${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`, phoneVerifiedAt: new Date() } });
  userIds.push(user.id);
  business = await prisma.business.create({ data: {
    slug: prefix, name: 'Delivery integration', plan: 'exclusive', paidUntil: later(),
    settings: { create: { reminderChannel: 'EMAIL', reminderLeadHours: 168 } },
  } });
  staff = await prisma.staffMember.create({ data: { businessId: business.id, userId: user.id, displayName: 'Test staff' } });
  client = await prisma.client.create({ data: { businessId: business.id, name: 'Verified client', email: user.email, phone: user.phone, userId: user.id, identityVerifiedAt: new Date() } });
});
after(async () => {
  if (business) await prisma.business.delete({ where: { id: business.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('paid reservation serializes concurrent requests and rejects projected overspend', async () => {
  await reset();
  let sends = 0;
  const results = await Promise.all(Array.from({ length: 6 }, (_, n) => sendGuardedSms(paid(`cap-${n}`), {
    config: { ...config, capAgorot: 15, alertAgorot: 15 }, sendSms: async () => { sends++; }, onAlert: noop,
  })));
  assert.equal(sends, 1);
  assert.equal(results.filter((r) => r.status === 'sent').length, 1);
  const usage = await prisma.messageLog.aggregate({ where: { businessId: business.id }, _sum: { costAgorot: true } });
  assert.equal(usage._sum.costAgorot, 10);
});

test('booking confirmations use the same exhausted paid budget boundary', async () => {
  await reset();
  const appt = await appointment();
  await prisma.messageLog.create({ data: { businessId: business.id, body: 'prior usage', channel: 'sms', status: 'SENT', costAgorot: 4500, countsToCap: true } });
  let sends = 0;
  const result = await notifyClientOfBooking({
    appointmentId: appt.id, businessId: business.id, businessName: business.name,
    clientName: client.name, clientPhone: client.phone, canEmail: false, canWhatsapp: true,
    services: [], startAt: appt.startAt, timezone: 'Asia/Jerusalem',
  }, { sendGuardedSms: (req) => sendGuardedSms(req, { config, sendSms: async () => { sends++; }, onAlert: noop }) });
  assert.equal(result.messaged, false);
  assert.equal(sends, 0);
  assert.ok(result.errors.some((error) => error.includes('cost_cap_exceeded')));
});

test('guest and mismatched contacts cannot trigger paid delivery', async () => {
  await reset();
  const guest = await prisma.client.create({ data: { businessId: business.id, name: 'Guest', phone: client.phone } });
  let sends = 0;
  const deps = { config, sendSms: async () => { sends++; }, onAlert: noop };
  assert.equal((await sendGuardedSms({ ...paid('guest'), clientId: guest.id }, deps)).status, 'blocked');
  assert.equal((await sendGuardedSms({ ...paid('mismatch'), to: '+972509999999' }, deps)).status, 'blocked');
  assert.equal((await sendGuardedSms({ ...paid('bypass'), countsToCap: false }, deps)).status, 'blocked');
  await prisma.client.update({ where: { id: client.id }, data: { identityVerifiedAt: null } });
  assert.equal((await sendGuardedSms(paid('legacy-unverified-link'), deps)).status, 'blocked');
  await prisma.client.update({ where: { id: client.id }, data: { identityVerifiedAt: new Date() } });
  assert.equal(sends, 0);
});

test('recipient, business and global quotas are distributed and observable', async () => {
  await reset();
  const settings = ['PAID_RECIPIENT_HOURLY_LIMIT', 'PAID_BUSINESS_HOURLY_LIMIT', 'PAID_GLOBAL_HOURLY_LIMIT', 'PAID_GLOBAL_MONTHLY_CAP_AGOROT'];
  for (const [index, name] of settings.entries()) {
    const previous = process.env[name];
    process.env[name] = '0';
    try {
      let sends = 0;
      const result = await sendGuardedSms(paid(`quota-${index}`), { config, sendSms: async () => { sends++; } });
      assert.equal(result.status, 'blocked');
      assert.equal(sends, 0);
    } finally {
      if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
    }
  }
  assert.equal(await prisma.messageLog.count({ where: { businessId: business.id, status: 'BLOCKED' } }), 4);
});

test('inactive and pending-deletion businesses cannot send campaign email or paid messages', async () => {
  for (const state of ['expired', 'deletion']) {
    await reset();
    await prisma.business.update({ where: { id: business.id }, data: state === 'expired' ? { paidUntil: new Date(0) } : { accountStatus: 'PENDING_DELETION' } });
    const campaign = await prisma.campaign.create({ data: { businessId: business.id, name: 'Test campaign', body: 'Test', segment: 'all', channels: ['email'] } });
    assert.deepEqual(await sendCampaign(business.id, campaign.id), { ok: false, reason: 'business_inactive' });
    let sends = 0;
    assert.equal((await sendGuardedSms(paid(`inactive-${state}`), { config, sendSms: async () => { sends++; } })).status, 'blocked');
    const email = await deliverEmailOnce({ businessId: business.id, idempotencyKey: state, to: client.email!, subject: 'Test', text: 'Test' }, { configured: true, send: async () => { sends++; } });
    assert.equal(email.status, 'blocked');
    assert.equal(sends, 0);
  }
});

test('active basic businesses can send campaign email', async () => {
  await reset();
  await prisma.business.update({ where: { id: business.id }, data: {
    plan: 'basic', subscriptionStatus: 'trialing', trialEndsAt: later(), paidUntil: null,
  } });
  const campaign = await prisma.campaign.create({ data: {
    businessId: business.id, name: 'Basic email campaign', body: 'Test',
    segment: 'all', channels: ['email'],
  } });
  let sends = 0;
  const result = await sendCampaign(business.id, campaign.id, {
    deliverEmailOnce: async () => { sends += 1; return { status: 'sent' }; },
  });
  assert.deepEqual(result, { ok: true, recipientCount: 1, sentCount: 1, failedCount: 0 });
  assert.equal(sends, 1);
});

test('paid provider uncertainty and post-send DB failure retain reservations and never resend', async () => {
  for (const failure of ['provider', 'storage']) {
    await reset();
    let sends = 0;
    const failingDb = prisma.$extends({ query: { messageLog: { async update({ args, query }) {
      if (args.data.status === 'SENT') throw new Error('injected finalization failure');
      return query(args);
    } } } }) as unknown as PrismaClient;
    const req = paid(`unknown-${failure}`);
    const result = await sendGuardedSms(req, { config, prismaClient: failure === 'storage' ? failingDb : prisma, sendSms: async () => {
      sends++;
      if (failure === 'provider') throw new Error('response lost after possible acceptance');
    } });
    assert.deepEqual(result, { status: 'failed', error: 'delivery_outcome_unknown' });
    assert.equal((await sendGuardedSms(req, { config, sendSms: async () => { sends++; } })).status, 'blocked');
    assert.equal(sends, 1);
    assert.equal((await prisma.messageLog.aggregate({ where: { businessId: business.id }, _sum: { costAgorot: true } }))._sum.costAgorot, 10);
  }
});

test('waitlist absent/failed delivery remains retryable and cancellation wins in flight', async () => {
  await reset();
  await prisma.business.update({ where: { id: business.id }, data: { plan: 'premium' } });
  const noChannel = await prisma.waitlistEntry.create({ data: { businessId: business.id, name: 'No channel', phone: client.phone! } });
  assert.deepEqual(await notifyWaitlistEntry(business.id, noChannel.id), { ok: false, reason: 'no_channel' });
  assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: noChannel.id } })).status, 'WAITING');
  const entry = await prisma.waitlistEntry.create({ data: { businessId: business.id, name: 'Waiter', phone: client.phone!, email: 'waiter@example.test' } });
  const failure = await notifyWaitlistEntry(business.id, entry.id, { emailConfigured: true, sendEmail: async () => { throw Object.assign(new Error('rejected'), { code: 'ECONNECTION' }); } });
  assert.deepEqual(failure, { ok: false, reason: 'delivery_failed' });
  assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).notifyClaimToken, null);
  const started = deferred(), release = deferred();
  let sends = 0;
  const inFlight = notifyWaitlistEntry(business.id, entry.id, { emailConfigured: true, sendEmail: async () => { sends++; started.resolve(); await release.promise; } });
  await started.promise;
  assert.deepEqual(await notifyWaitlistEntry(business.id, entry.id, { emailConfigured: true }), { ok: false, reason: 'delivery_in_progress' });
  assert.equal(await cancelWaitlistEntry(business.id, entry.id), true);
  release.resolve();
  assert.deepEqual(await inFlight, { ok: false, reason: 'not_waiting' });
  assert.equal(sends, 1);
  assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status, 'CANCELLED');
});

test('overlapping real reminder workers claim before dispatch and count actual sends', async () => {
  await reset();
  const appt = await appointment();
  const started = deferred(), release = deferred();
  let sends = 0;
  const deps = {
    ...defaultReminderDeps, reconcilePendingCalendars: undefined,
    getAppointmentsDueForReminder: async (start: Date, end: Date) => (await defaultReminderDeps.getAppointmentsDueForReminder(start, end)).filter((row) => row.id === appt.id),
    sendReminder: (row: Parameters<typeof sendReminder>[0]) => sendReminder(row, {
      emailConfigured: true, sendEmail: async () => { sends++; started.resolve(); await release.promise; },
    }),
  };
  const request = () => new Request('http://localhost/api/cron/reminders', { headers: { 'x-cron-secret': process.env.CRON_SECRET! } });
  const first = handleReminderCron(request(), deps);
  await started.promise;
  const second = await (await handleReminderCron(request(), deps)).json();
  assert.equal(second.counts.claimedElsewhere, 1);
  assert.equal(second.counts.sent, 0);
  release.resolve();
  assert.equal((await (await first).json()).counts.sent, 1);
  assert.equal(sends, 1);
  assert.ok((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).reminderSentAt);
});

test('partial reminders retry rejected channels without repeating successful deliveries', async () => {
  await reset();
  const appt = await appointment();
  const input = {
    id: appt.id, startAt: appt.startAt, confirmToken: appt.confirmToken,
    business: { id: business.id, name: business.name, timezone: business.timezone,
      isExclusive: true, settings: { reminderChannel: 'BOTH' } },
    client,
  };
  let emails = 0, paidSends = 0;
  const deps = {
    emailConfigured: true,
    deliverEmail: (req: Parameters<typeof deliverEmailOnce>[0]) => deliverEmailOnce(req, {
      configured: true, send: async () => {
        if (++emails === 1) throw Object.assign(new Error('rejected'), { code: 'EENVELOPE' });
      },
    }),
    sendGuardedSms: (req: Parameters<typeof sendGuardedSms>[0]) => sendGuardedSms(req, {
      config, onAlert: noop, sendSms: async () => { paidSends++; },
    }),
  };
  assert.deepEqual(await sendReminder(input, deps), {
    status: 'failed', channel: 'EMAIL', error: 'provider_rejected', deliveredChannels: ['SMS'],
  });
  assert.deepEqual(await sendReminder(input, deps), { status: 'sent', channel: 'EMAIL' });
  assert.deepEqual(await sendReminder(input, deps), { status: 'sent', channel: 'EMAIL', duplicate: true });
  assert.equal(emails, 2);
  assert.equal(paidSends, 1);
});

test('reminder failed finalization is quarantined; stale pre-dispatch leases alone recover', async () => {
  await reset();
  const appt = await appointment();
  const token = await claimReminder(appt.id);
  assert.ok(token);
  await prisma.appointment.update({ where: { id: appt.id }, data: { reminderClaimedAt: new Date(0) } });
  const recovered = await claimReminder(appt.id);
  assert.ok(recovered && recovered !== token);
  assert.equal(await beginReminderDispatch(appt.id, recovered), true);
  await prisma.appointment.update({ where: { id: appt.id }, data: { reminderClaimedAt: new Date(0) } });
  assert.equal(await claimReminder(appt.id), null);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).reminderLastError, 'delivery_outcome_unknown');
});

test('enabling reminders after booking creates one durable intent and sends once', async () => {
  await reset();
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { remindersEnabled: false } });
  const appt = await appointment({ withIntent: false });
  assert.equal(await claimReminder(appt.id), null);
  assert.equal(await prisma.reminder.count({ where: { appointmentId: appt.id } }), 0);
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { remindersEnabled: true } });
  let providerCalls = 0;
  const deps = reminderWorker(appt.id, (row) => prepareReminder(row, {
    emailConfigured: true, sendEmail: async () => { providerCalls++; },
  }));
  await Promise.all([handleReminderCron(reminderRequest(), deps), handleReminderCron(reminderRequest(), deps)]);
  const intents = await prisma.reminder.findMany({ where: { appointmentId: appt.id } });
  assert.equal(intents.length, 1);
  assert.equal(intents[0].status, 'SENT');
  assert.equal(providerCalls, 1);
});

test('current lead time replaces obsolete intent timing and is rechecked before dispatch', async () => {
  await reset();
  const appt = await appointment({ startAt: new Date(Date.now() + 72 * 3600000) });
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { reminderLeadHours: 2 } });
  assert.equal(await claimReminder(appt.id), null);
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { reminderLeadHours: 96 } });
  const token = await claimReminder(appt.id);
  assert.ok(token);
  let intent = await prisma.reminder.findFirstOrThrow({ where: { appointmentId: appt.id } });
  assert.equal(intent.sendAt.getTime(), appt.startAt.getTime() - 96 * 3600000);
  await prisma.businessSettings.update({ where: { businessId: business.id }, data: { reminderLeadHours: 1 } });
  assert.equal(await beginReminderDispatch(appt.id, token), false);
  await releaseReminder(appt.id, token, 'lifecycle_changed');
  intent = await prisma.reminder.findFirstOrThrow({ where: { appointmentId: appt.id } });
  assert.equal(intent.sendAt.getTime(), appt.startAt.getTime() - 3600000);
  assert.equal(intent.status, 'SCHEDULED');
});

test('real pre-provider eligibility DB failure releases intent for healthy worker retry', async () => {
  await reset();
  const appt = await appointment();
  let healthy = false, providerCalls = 0;
  const deps = reminderWorker(appt.id, (row) => prepareReminder(row, {
    emailConfigured: true,
    canDeliverEmail: async () => {
      if (!healthy) await prisma.$queryRaw`SELECT 1 / 0`;
      return true;
    },
    sendEmail: async () => { providerCalls++; },
  }));
  const failure = await (await handleReminderCron(reminderRequest(), deps)).json();
  assert.equal(failure.counts.failed, 1);
  assert.equal(failure.counts.uncertain, 0);
  assert.equal(providerCalls, 0);
  const beforeRetry = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
  assert.equal(beforeRetry.reminderClaimToken, null);
  assert.equal(beforeRetry.reminderLastError, 'preparation_failed');
  assert.equal(beforeRetry.reminderSentAt, null);
  assert.equal((await prisma.reminder.findFirstOrThrow({ where: { appointmentId: appt.id } })).status, 'SCHEDULED');
  healthy = true;
  const success = await (await handleReminderCron(reminderRequest(), deps)).json();
  assert.equal(success.counts.sent, 1);
  assert.equal(success.counts.claimedElsewhere, 0);
  assert.equal(providerCalls, 1);
});

test('intent reconciliation never revives sent, cancelled, or ambiguous reminders', async () => {
  await reset();
  for (const status of ['SENT', 'CANCELLED'] as const) {
    const appt = await appointment();
    await prisma.reminder.updateMany({ where: { appointmentId: appt.id }, data: { status } });
    assert.equal(await claimReminder(appt.id), null);
    assert.equal((await prisma.reminder.findFirstOrThrow({ where: { appointmentId: appt.id } })).status, status);
  }
  const appt = await appointment({ withIntent: false });
  await prisma.appointment.update({ where: { id: appt.id }, data: { reminderLastError: 'delivery_outcome_unknown' } });
  assert.equal(await claimReminder(appt.id), null);
  assert.equal(await prisma.reminder.count({ where: { appointmentId: appt.id } }), 0);
});

for (const cleanupFails of [false, true]) {
  test(`nested reminder outbox eligibility failure retries safely (cleanup failure: ${cleanupFails})`, async () => {
    await reset();
    const appt = await appointment();
    let checks = 0, healthy = false, providerCalls = 0;
    const outbox: NonNullable<EmailDeliveryDeps['prismaClient']> = {
      $transaction: (work) => prisma.$transaction(work),
      messageLog: {
        findUnique: (args) => prisma.messageLog.findUnique(args),
        create: (args) => prisma.messageLog.create(args),
        update: (args) => prisma.messageLog.update(args),
        updateMany: async (args) => {
          if (!healthy && cleanupFails && args.data?.status === 'FAILED') await prisma.$queryRaw`SELECT 1 / 0`;
          return prisma.messageLog.updateMany(args);
        },
      },
    };
    const deps = reminderWorker(appt.id, (row) => prepareReminder(row, {
      emailConfigured: true,
      deliverEmail: (req) => deliverEmailOnce(req, {
        configured: true, prismaClient: outbox,
        canDeliverEmail: async (businessId, appointmentId) => {
          if (++checks === 2) await prisma.$queryRaw`SELECT 1 / 0`;
          return canDeliverClientEmail(businessId, appointmentId);
        },
        send: async () => { providerCalls++; },
      }),
    }));
    const first = await (await handleReminderCron(reminderRequest(), deps)).json();
    assert.equal(first.counts.failed, 1);
    assert.equal(first.counts.uncertain, 0);
    assert.equal(providerCalls, 0);
    const row = await prisma.messageLog.findFirstOrThrow({ where: { businessId: business.id, channel: 'email' } });
    assert.equal(row.status, cleanupFails ? 'RESERVED' : 'FAILED');
    if (cleanupFails) assert.match(row.error ?? '', /^preparing:/);
    let appointmentState = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    assert.equal(appointmentState.reminderClaimToken, null);
    assert.equal(appointmentState.reminderLastError, 'preparation_failed');
    healthy = true;
    if (cleanupFails) {
      const waiting = await (await handleReminderCron(reminderRequest(), deps)).json();
      assert.equal(waiting.counts.failed, 1);
      assert.equal(waiting.counts.uncertain, 0);
      assert.equal(providerCalls, 0);
      await prisma.messageLog.update({ where: { id: row.id }, data: { reservedAt: new Date(0) } });
    }
    await Promise.all([handleReminderCron(reminderRequest(), deps), handleReminderCron(reminderRequest(), deps)]);
    assert.equal(providerCalls, 1);
    assert.equal((await prisma.messageLog.findUniqueOrThrow({ where: { id: row.id } })).status, 'SENT');
    appointmentState = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    assert.ok(appointmentState.reminderSentAt);
    assert.equal(appointmentState.reminderLastError, null);
  });
}

test('expired email preparer cannot clear a newer owner reservation after its DB failure', async () => {
  await reset();
  const appt = await appointment();
  const req = { businessId: business.id, appointmentId: appt.id, clientId: client.id,
    idempotencyKey: `owner:${appt.id}`, to: client.email!, subject: 'Test', text: 'Test' };
  const entered = deferred(), resume = deferred(), replacementEntered = deferred(), replacementResume = deferred();
  let oldChecks = 0, newChecks = 0, providerCalls = 0;
  const send = async () => { providerCalls++; };
  const old = deliverEmailOnce(req, { configured: true, send, canDeliverEmail: async (businessId, appointmentId) => {
    if (++oldChecks === 2) { entered.resolve(); await resume.promise; await prisma.$queryRaw`SELECT 1 / 0`; }
    return canDeliverClientEmail(businessId, appointmentId);
  } });
  await entered.promise;
  const row = await prisma.messageLog.findFirstOrThrow({ where: { businessId: business.id, channel: 'email' } });
  await prisma.messageLog.update({ where: { id: row.id }, data: { reservedAt: new Date(0) } });
  const replacement = deliverEmailOnce(req, { configured: true, send, canDeliverEmail: async (businessId, appointmentId) => {
    if (++newChecks === 2) { replacementEntered.resolve(); await replacementResume.promise; }
    return canDeliverClientEmail(businessId, appointmentId);
  } });
  await replacementEntered.promise;
  const replacementRow = await prisma.messageLog.findUniqueOrThrow({ where: { id: row.id } });
  assert.notEqual(replacementRow.error, row.error);
  resume.resolve();
  assert.equal((await old).status, 'failed');
  assert.equal((await prisma.messageLog.findUniqueOrThrow({ where: { id: row.id } })).error, replacementRow.error);
  assert.equal(providerCalls, 0);
  replacementResume.resolve();
  assert.equal((await replacement).status, 'sent');
  assert.equal(providerCalls, 1);
});

test('Google create/cancel race removes deterministic event and durable pending work survives failures', async () => {
  await reset();
  const appt = await appointment();
  await prisma.staffCalendarConnection.create({
    data: {
      staffId: staff.id, businessId: business.id, calendarId: 'test',
      accessTokenEnc: 'synthetic-unused', refreshTokenEnc: 'synthetic-unused',
    },
  });
  process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true';
  process.env.GOOGLE_CLIENT_ID = 'test';
  process.env.GOOGLE_CLIENT_SECRET = 'test';
  const started = deferred(), release = deferred();
  const deleted: string[] = [];
  const deps = {
    getAccessToken: async () => 'test-token-not-live', recordOk: noop, recordError: noop,
    insertEvent: async ({ event }: Parameters<typeof insertEvent>[0]) => {
      assert.equal(event.id, appointmentGoogleEventId(appt.id));
      started.resolve(); await release.promise; return event.id!;
    },
    deleteEvent: async ({ eventId }: { eventId: string }) => { deleted.push(eventId); },
  };
  try {
    const creating = reconcileAppointmentCalendar(appt.id, deps);
    await started.promise;
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED', googleSyncPending: true } });
    await reconcileAppointmentCalendar(appt.id, deps);
    release.resolve();
    await creating;
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    assert.equal(row.status, 'CANCELLED');
    assert.equal(row.googleCalendarEventId, null);
    assert.equal(row.googleSyncPending, false);
    assert.deepEqual(deleted, [appointmentGoogleEventId(appt.id)]);
    await prisma.appointment.update({ where: { id: appt.id }, data: { googleSyncPending: true } });
    await reconcileAppointmentCalendar(appt.id, { ...deps, deleteEvent: async () => { throw new Error('provider unavailable'); } });
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).googleSyncPending, true);
  } finally {
    delete process.env.GOOGLE_CALENDAR_SYNC_ENABLED;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  }
});
