import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient, Business, Client, StaffMember } from '@prisma/client';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

assert.ok(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must name a disposable migrated database');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET = 'tenant-identity-integration-secret-not-for-production';
process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
process.env.SESSION_SECRET = 'tenant-identity-client-test-secret';
process.env.AUTH_TRUST_HOST = 'true';
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;
// Exercise the real Firebase SDK's local-emulator token path, never a live provider.
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:1';
process.env.FIREBASE_PROJECT_ID = 'torchick-identity-integration';
process.env.FIREBASE_CLIENT_EMAIL = 'integration@torchick-identity-integration.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

// Match Next's server bundle alias; no application functions or database calls are mocked.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    );
  },
});
require('next/dist/server/node-environment-baseline');
const { NextRequest } = require('next/server') as typeof import('next/server');
const { encode } = require('next-auth/jwt') as typeof import('next-auth/jwt');
const { createRequestStoreForAPI } = require('next/dist/server/async-storage/request-store') as typeof import('next/dist/server/async-storage/request-store');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external') as typeof import('next/dist/server/app-render/work-unit-async-storage.external');
const { prisma } = require('../src/lib/db') as { prisma: PrismaClient };
const { getActiveBusiness, createBusiness, BusinessCreationLimitError, MAX_BUSINESSES_PER_OWNER } = require('../src/server/repos/business') as typeof import('../src/server/repos/business');
const { computeTrialHashes } = require('../src/server/repos/trialLedger') as typeof import('../src/server/repos/trialLedger');
const { getBusinessAccess } = require('../src/server/subscription') as typeof import('../src/server/subscription');
const { findOrCreateClient } = require('../src/server/repos/clients') as typeof import('../src/server/repos/clients');
const { getAppointmentsForUser, getUpcomingAppointmentsForUserAtBusiness } = require('../src/server/repos/account') as typeof import('../src/server/repos/account');
const { serializeSession } = require('../src/lib/session') as typeof import('../src/lib/session');
const { signImpersonationValue } = require('../src/server/impersonationToken') as typeof import('../src/server/impersonationToken');
const { getImpersonatedBusinessId } = require('../src/server/impersonation') as typeof import('../src/server/impersonation');
const { uploadMedia } = require('../src/server/media/upload') as typeof import('../src/server/media/upload');
const { storeBusinessMedia } = require('../src/server/media/storage') as typeof import('../src/server/media/storage');
const { saveAllSettingsAction } = require('../src/app/admin/settings/actions') as typeof import('../src/app/admin/settings/actions');
const { toggleServiceHiddenAction } = require('../src/app/admin/services/actions') as typeof import('../src/app/admin/services/actions');
const { saveStaffAction } = require('../src/app/admin/team/actions') as typeof import('../src/app/admin/team/actions');
const { setSaleLinksAction } = require('../src/app/admin/pos/actions') as typeof import('../src/app/admin/pos/actions');
const { POST: subscribe } = require('../src/app/api/push/subscribe/route') as typeof import('../src/app/api/push/subscribe/route');
const { GET: returning } = require('../src/app/api/public/b/[slug]/returning/route') as typeof import('../src/app/api/public/b/[slug]/returning/route');
const { createOtp } = require('../src/server/repos/otp') as typeof import('../src/server/repos/otp');
const { POST: verifyPhoneOtp } = require('../src/app/api/otp/verify/route') as typeof import('../src/app/api/otp/verify/route');
const { POST: verifyEmailOtp } = require('../src/app/api/otp/email/verify/route') as typeof import('../src/app/api/otp/email/verify/route');
const { POST: verifyFirebasePhone } = require('../src/app/api/auth/firebase-phone/route') as typeof import('../src/app/api/auth/firebase-phone/route');
const { provisionBusinessAction, editBusinessDetailsAction } = require('../src/app/superadmin/actions') as typeof import('../src/app/superadmin/actions');
const { getBusinessesOwnedByEmail, BusinessIdentityConflictError } = require('../src/server/repos/business') as typeof import('../src/server/repos/business');
const { ownerEmailForPhone } = require('../src/lib/ownerPhoneIdentity') as typeof import('../src/lib/ownerPhoneIdentity');

const prefix = `tenant-${randomUUID()}`;
const ownerEmail = `${prefix}-owner@example.test`;
const outsiderEmail = `${prefix}-outsider@example.test`;
const adminEmail = `${prefix}-admin@example.test`;
process.env.PLATFORM_ADMIN_EMAILS = adminEmail;
const userIds: string[] = [];
const registrationEmails: string[] = [];
const verifiedPhones: string[] = [];
const otpIdentities: string[] = [];
let business: Business;
let otherBusiness: Business;
let staff: StaffMember;
let victim: Client;
let attackerUserId: string;
let victimUserId: string;
let victimAppointmentId: string;
let serviceId: string;
let otherServiceId: string;

function form(values: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

async function ownerCookie(email: string): Promise<string> {
  return `authjs.session-token=${await encode({
    token: { email },
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token',
  })}`;
}

function clientCookie(userId: string, email?: string, phone?: string): string {
  return `client_session=${serializeSession({
    userId, email, phone, exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
}

async function inRequest<T>(
  cookie: string,
  action: (request: Request) => Promise<T>,
  path = '/admin/settings',
): Promise<T> {
  const request = new NextRequest(`http://localhost${path}`, {
    headers: { host: 'localhost', 'x-forwarded-proto': 'http', cookie },
  });
  const implicitTags = {
    tags: [], expirationsByCacheHandler: new Map(), expirationsByCacheKind: new Map(),
  };
  const store = createRequestStoreForAPI(
    request, new URL(request.url), implicitTags,
    undefined, undefined,
  );
  const work = {
    isStaticGeneration: false, route: path, incrementalCache: {},
    pendingRevalidatedTags: [],
  } as unknown as WorkStore;
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, () => action(request)));
}

function settingsForm(name: string): FormData {
  return form({
    name, slotGranularityMinutes: '15', maxAdvanceBookingDays: '30',
    minLeadTimeMinutes: '0', cancellationWindowHours: '0', reminderLeadHours: '24',
  });
}

before(async () => {
  const staffUser = await prisma.user.create({ data: { phone: `+9725${Date.now().toString().slice(-8)}` } });
  const attacker = await prisma.user.create({ data: { email: outsiderEmail, emailVerified: new Date() } });
  const victimUser = await prisma.user.create({ data: { email: `${prefix}-victim@example.test` } });
  userIds.push(staffUser.id, attacker.id, victimUser.id);
  attackerUserId = attacker.id;
  victimUserId = victimUser.id;
  business = await prisma.business.create({
    data: {
      slug: `${prefix}-a`, name: 'Tenant A', ownerEmail, plan: 'basic',
      trialEndsAt: new Date(Date.now() + 86400000), settings: { create: {} },
    },
  });
  otherBusiness = await prisma.business.create({
    data: {
      slug: `${prefix}-b`, name: 'Tenant B', ownerEmail: `${prefix}-other@example.test`,
      plan: 'premium', paidUntil: new Date(Date.now() + 86400000),
    },
  });
  staff = await prisma.staffMember.create({
    data: { businessId: business.id, userId: staffUser.id, displayName: 'Staff' },
  });
  const service = await prisma.service.create({
    data: { businessId: business.id, name: 'Service', durationMin: 30, priceAgorot: 1000 },
  });
  const otherService = await prisma.service.create({
    data: { businessId: otherBusiness.id, name: 'Other service', durationMin: 30, priceAgorot: 1000 },
  });
  serviceId = service.id;
  otherServiceId = otherService.id;
  victim = await prisma.client.create({
    data: { businessId: business.id, name: 'Victim', phone: '+972501234567' },
  });
  const appointment = await prisma.appointment.create({
    data: {
      businessId: business.id, staffId: staff.id, clientId: victim.id,
      startAt: new Date(Date.now() + 3600000), endAt: new Date(Date.now() + 5400000),
      status: 'CONFIRMED', totalPriceAgorot: 1000,
      services: { create: {
        serviceId, nameSnapshot: 'Private treatment', durationMinSnapshot: 30,
        priceAgorotSnapshot: 1000,
      } },
    },
  });
  victimAppointmentId = appointment.id;
});

after(async () => {
  const ids = [business?.id, otherBusiness?.id].filter((id): id is string => Boolean(id));
  await prisma.appointment.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  await prisma.business.deleteMany({ where: { ownerEmail: { in: registrationEmails } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { email: { in: registrationEmails } } });
  await prisma.user.deleteMany({ where: { phone: { in: verifiedPhones } } });
  await prisma.otpCode.deleteMany({ where: { phone: { in: otpIdentities } } });
  await prisma.trialLedger.deleteMany({
    where: { emailHash: { in: registrationEmails.map((email) => computeTrialHashes(email, null).emailHash) } },
  });
  await prisma.$disconnect();
});

test('anonymous, client-only and authenticated non-owner cannot resolve a tenant or change settings', async () => {
  for (const cookie of ['', clientCookie(attackerUserId, outsiderEmail), await ownerCookie(outsiderEmail)]) {
    assert.equal(await inRequest(cookie, () => getActiveBusiness()), null);
    const result = await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, settingsForm('Injected')));
    assert.equal(result.ok, false);
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).name, 'Tenant A');
  }
});

test('active trial owner can mutate its own tenant but not another tenant resource', async () => {
  const cookie = await ownerCookie(ownerEmail);
  assert.equal((await inRequest(cookie, () => getActiveBusiness()))?.id, business.id);
  const own = await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, settingsForm('Owner saved')));
  assert.equal(own.ok, true);
  assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).name, 'Owner saved');
  await inRequest(cookie, () => toggleServiceHiddenAction(form({ id: otherServiceId, hidden: 'true' })));
  assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: otherServiceId } })).hidden, false);
  await inRequest(cookie, () => toggleServiceHiddenAction(form({ id: serviceId, hidden: 'true' })));
  assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })).hidden, true);
});

test('settings rejects new embedded media while preserving unchanged legacy bytes', async () => {
  const cookie = await ownerCookie(ownerEmail);
  const before = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
  const legacy = `data:image/png;base64,${'a'.repeat(70000)}`;
  const landingContent = { heroImages: [legacy], galleryImageUrls: [legacy], about: 'Legacy page' };
  await prisma.business.update({
    where: { id: business.id },
    data: { logoUrl: legacy, publicPageStyle: 'LANDING', landingContent },
  });
  try {
    const unchanged = settingsForm('Legacy owner edit');
    unchanged.set('logoUrl', legacy);
    unchanged.set('heroImage0', legacy.slice(0, 2048));
    assert.equal((await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, unchanged))).ok, true);
    const preserved = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    assert.equal(preserved.logoUrl, legacy);
    assert.deepEqual(preserved.landingContent, landingContent);
    for (const [key, value] of [
      ['logoUrl', 'data:image/png;base64,new'],
      ['heroImage0', `${legacy}changed`],
      ['coverImageUrl', legacy],
      ['heroImage1', 'data:image/png;base64,new'],
      ['coverImageUrl', `https://example.test/${'x'.repeat(3000)}`],
    ]) {
      const fd = settingsForm('Must not persist');
      fd.set('logoUrl', legacy);
      fd.set('heroImage0', legacy);
      fd.set(key, value);
      assert.equal((await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, fd))).ok, false);
      assert.deepEqual(await prisma.business.findUniqueOrThrow({ where: { id: business.id } }), preserved);
    }
    const uploaded = settingsForm('Uploaded media');
    uploaded.set('logoUrl', '/uploads/example.webp');
    uploaded.set('heroImage0', 'https://assets.example.test/hero.webp');
    assert.equal((await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, uploaded))).ok, true);
  } finally {
    const { Prisma } = require('@prisma/client') as typeof import('@prisma/client');
    await prisma.business.update({
      where: { id: business.id }, data: {
        name: before.name, logoUrl: before.logoUrl, coverImageUrl: before.coverImageUrl,
        publicPageStyle: before.publicPageStyle,
        landingContent: before.landingContent ?? Prisma.DbNull,
      },
    });
  }
});

test('expired and deletion-pending owners cannot mutate or subscribe; explicit recovery lookup stays available', async () => {
  const cookie = await ownerCookie(ownerEmail);
  for (const data of [
    { trialEndsAt: new Date(0) },
    { trialEndsAt: new Date(Date.now() + 86400000), accountStatus: 'PENDING_DELETION' as const },
  ]) {
    await prisma.business.update({ where: { id: business.id }, data });
    assert.equal(await inRequest(cookie, () => getActiveBusiness()), null);
    assert.equal((await inRequest(cookie, () => getActiveBusiness({ allowInactive: true })))?.id, business.id);
    const result = await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, settingsForm('Suspended write')));
    assert.equal(result.ok, false);
    const response = await inRequest(cookie, () => subscribe(pushRequest(`${prefix}-suspended`)));
    assert.equal(response.status, 403);
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).name, 'Owner saved');
  }
  assert.equal(await inRequest(await ownerCookie(outsiderEmail), () => getActiveBusiness({ allowInactive: true })), null);
  await prisma.business.update({
    where: { id: business.id },
    data: { accountStatus: 'ACTIVE', trialEndsAt: new Date(Date.now() + 86400000) },
  });
});

test('only an authenticated platform admin with a valid explicit token may impersonate', async () => {
  const token = signImpersonationValue(otherBusiness.id);
  assert.equal(await inRequest(`tc_imp=${token}`, () => getActiveBusiness()), null);
  assert.equal(await inRequest(`${await ownerCookie(outsiderEmail)}; tc_imp=${token}`, () => getActiveBusiness()), null);
  assert.equal(await inRequest(await ownerCookie(adminEmail), () => getActiveBusiness()), null);
  assert.equal(await inRequest(`${await ownerCookie(adminEmail)}; tc_imp=${token}tampered`, () => getActiveBusiness()), null);
  const cookie = `${await ownerCookie(adminEmail)}; tc_imp=${token}`;
  assert.equal((await inRequest(cookie, () => getActiveBusiness()))?.id, otherBusiness.id);
  const stale = `${await ownerCookie(ownerEmail)}; tc_imp=${signImpersonationValue('nonexistent')}`;
  // A regular owner's token does not grant impersonation authority.
  assert.equal((await inRequest(stale, () => getActiveBusiness()))?.id, business.id);
  const deletedTarget = `${await ownerCookie(adminEmail)}; tc_imp=${signImpersonationValue('nonexistent')}`;
  await prisma.business.update({ where: { id: business.id }, data: { ownerEmail: adminEmail } });
  try {
    assert.equal((await inRequest(await ownerCookie(adminEmail), () => getActiveBusiness()))?.id, business.id);
    assert.equal(await inRequest(deletedTarget, () => getActiveBusiness()), null);
  } finally {
    await prisma.business.update({ where: { id: business.id }, data: { ownerEmail } });
  }
});

function pushRequest(token: string, endpoint = `https://fcm.googleapis.com/fcm/send/${token}`): Request {
  return new Request('http://localhost/api/push/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint, keys: { auth: 'auth', p256dh: 'key' } }),
  });
}

test('onboarding uploads select the explicitly authorized business and charge only its storage', async () => {
  const configured = process.env.MEDIA_STORAGE_CONNECTION;
  delete process.env.MEDIA_STORAGE_CONNECTION;
  const cookie = `${await ownerCookie(adminEmail)}; tc_imp=${signImpersonationValue(otherBusiness.id)}`;
  await prisma.business.update({
    where: { id: business.id }, data: { ownerEmail: adminEmail, trialEndsAt: new Date(0) },
  });
  try {
    // Reaching the configuration guard proves the active target, rather than the expired first-owned business, was selected.
    assert.equal((await inRequest(cookie, request => uploadMedia(request))).status, 503);
    assert.equal((await inRequest(await ownerCookie(adminEmail), request => uploadMedia(request))).status, 403);
    const uploaded: string[] = [];
    const container = {
      getBlockBlobClient: (key: string) => ({
        url: `https://storage.example.invalid/${key}`,
        exists: async () => false,
        uploadData: async () => { uploaded.push(key); },
      }),
      async *listBlobsFlat() { yield* []; },
    };
    const input = Buffer.from('synthetic-media');
    await assert.rejects(
      storeBusinessMedia(otherBusiness.id, adminEmail, input, 'image/webp', 'webp', container),
      { status: 403 },
    );
    await inRequest(cookie, async () => {
      const authority = await getImpersonatedBusinessId();
      await storeBusinessMedia(otherBusiness.id, adminEmail, input, 'image/webp', 'webp', container, authority);
      await assert.rejects(
        storeBusinessMedia(business.id, adminEmail, input, 'image/webp', 'webp', container, authority),
        { status: 403 },
      );
    });
    assert.equal(uploaded.length, 1);
    assert.ok(uploaded[0].startsWith(`media/${otherBusiness.id}/`));
    await inRequest(`${await ownerCookie(outsiderEmail)}; tc_imp=${signImpersonationValue(otherBusiness.id)}`, async () => {
      const authority = await getImpersonatedBusinessId();
      assert.equal(authority, null);
      await assert.rejects(
        storeBusinessMedia(otherBusiness.id, outsiderEmail, input, 'image/webp', 'webp', container, authority),
        { status: 403 },
      );
    });
  } finally {
    await prisma.business.update({
      where: { id: business.id }, data: { ownerEmail, trialEndsAt: business.trialEndsAt },
    });
    if (configured === undefined) delete process.env.MEDIA_STORAGE_CONNECTION;
    else process.env.MEDIA_STORAGE_CONNECTION = configured;
  }
});

test('push subscriptions require an owner and cannot be stolen across tenants', async () => {
  assert.equal((await inRequest('', () => subscribe(pushRequest(prefix)))).status, 401);
  assert.equal((await inRequest(await ownerCookie(outsiderEmail), () => subscribe(pushRequest(prefix)))).status, 403);
  const owner = await ownerCookie(ownerEmail);
  assert.equal((await inRequest(owner, () => subscribe(pushRequest(prefix)))).status, 200);
  assert.equal((await inRequest(owner, () => subscribe(pushRequest(prefix)))).status, 200);
  const other = await ownerCookie(otherBusiness.ownerEmail!);
  assert.equal((await inRequest(other, () => subscribe(pushRequest(prefix)))).status, 403);
  const stored = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: `https://fcm.googleapis.com/fcm/send/${prefix}` } });
  assert.equal(stored.businessId, business.id);
});

test('authenticated push registration rejects arbitrary/loopback destinations but accepts browser push services', async () => {
  const owner = await ownerCookie(ownerEmail);
  const before = await prisma.pushSubscription.count({ where: { businessId: business.id } });
  for (const endpoint of [
    'https://127.0.0.1:9443/push', 'https://[::1]/push', 'https://169.254.169.254/metadata',
    'http://fcm.googleapis.com/fcm/send/token', 'https://fcm.googleapis.com:9443/push',
    'https://fcm.googleapis.com.attacker.example/push', 'https://web.push.apple.com@127.0.0.1/push',
  ]) {
    const result = await inRequest(owner, () => subscribe(pushRequest(prefix, endpoint)));
    assert.equal(result.status, 400, endpoint);
  }
  assert.equal(await prisma.pushSubscription.count({ where: { businessId: business.id } }), before);
  for (const endpoint of [
    `https://updates.push.services.mozilla.com/wpush/v2/${prefix}`,
    `https://web.push.apple.com/${prefix}`,
    `https://wns2-db5p.notify.windows.com/w/?token=${prefix}`,
  ]) {
    assert.equal((await inRequest(owner, () => subscribe(pushRequest(prefix, endpoint)))).status, 200);
    assert.equal((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).businessId, business.id);
  }
});

test('guest contact collision never changes or links an existing client', async () => {
  const beforeVictim = await prisma.client.findUniqueOrThrow({ where: { id: victim.id } });
  const guest = await findOrCreateClient({
    businessId: business.id, name: 'Attacker assertion', phone: victim.phone, email: outsiderEmail,
  });
  assert.notEqual(guest.id, victim.id);
  assert.equal(guest.userId, null);
  assert.equal(guest.identityVerifiedAt, null);
  assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: victim.id } }), beforeVictim);
  assert.deepEqual(await getAppointmentsForUser({
    userId: attackerUserId, phone: victim.phone!, email: outsiderEmail,
  }), { upcoming: [], past: [] });
  assert.deepEqual(await getUpcomingAppointmentsForUserAtBusiness({
    userId: attackerUserId, phone: victim.phone!, email: outsiderEmail,
  }, business.id), []);
});

test('authenticated booking links only its fresh client; no guest/legacy contact auto-claim', async () => {
  const linked = await findOrCreateClient({
    businessId: business.id, userId: attackerUserId, phone: victim.phone, email: outsiderEmail, name: 'Verified attacker',
  });
  assert.notEqual(linked.id, victim.id);
  assert.ok(linked.identityVerifiedAt);
  assert.equal(linked.userId, attackerUserId);
  const again = await findOrCreateClient({
    businessId: business.id, userId: attackerUserId, phone: '+972509999999', name: 'Changed assertion',
  });
  assert.deepEqual(again, linked);
  assert.deepEqual(await getAppointmentsForUser({ userId: attackerUserId }), { upcoming: [], past: [] });
  await prisma.client.update({ where: { id: victim.id }, data: { userId: attackerUserId } });
  assert.deepEqual(await getAppointmentsForUser({ userId: attackerUserId }), { upcoming: [], past: [] });
  await prisma.client.update({
    where: { id: victim.id }, data: { userId: victimUserId, identityVerifiedAt: new Date() },
  });
  const own = await getAppointmentsForUser({ userId: victimUserId });
  assert.equal(own.upcoming[0]?.id, victimAppointmentId);
});

test('optional transaction rolls back guest contact on booking failure', async () => {
  const marker = `${prefix}-rolled-back`;
  await assert.rejects(prisma.$transaction(async (tx) => {
    await findOrCreateClient({ businessId: business.id, phone: victim.phone, name: marker }, tx);
    throw new Error('booking rejected');
  }), /booking rejected/);
  assert.equal(await prisma.client.count({ where: { businessId: business.id, name: marker } }), 0);
});

test('guest separation preserves deny-only blocked-contact policy without reusing the blocked client', async () => {
  const blocked = await prisma.client.create({
    data: { businessId: business.id, name: 'Blocked', phone: '+972507777777', blocked: true },
  });
  const guest = await findOrCreateClient({
    businessId: business.id, phone: blocked.phone, name: 'Another assertion',
  });
  assert.notEqual(guest.id, blocked.id);
  assert.equal(guest.blocked, true);
  assert.equal(guest.userId, null);
  assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: blocked.id } }), blocked);
});

test('returning endpoint exposes only verified appointments and never treats booked IDs as authority', async () => {
  const params = { params: Promise.resolve({ slug: business.slug }) };
  const attacker = clientCookie(attackerUserId, outsiderEmail, victim.phone!);
  const denied = await inRequest(attacker, (req) => returning(req, params));
  assert.deepEqual((await denied.json()).appointments, []);
  const guest = await inRequest('', (req) => returning(req, params), `/api/public/b/${business.slug}/returning?booked=${victimAppointmentId}`);
  const body = await guest.json();
  assert.deepEqual(body.appointments, []);
  assert.ok(!JSON.stringify(body).includes(victimAppointmentId));
  const owner = await inRequest(clientCookie(victimUserId), (req) => returning(req, params));
  assert.equal((await owner.json()).appointments[0]?.id, victimAppointmentId);
  assert.equal(owner.headers.get('cache-control'), 'no-store');
});

test('tenant staff editing cannot reassign global verified login identity', async () => {
  const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });
  const cookie = await ownerCookie(ownerEmail);
  const denied = await inRequest(cookie, () => saveStaffAction({ ok: false, mode: 'edit' }, form({
    id: staff.id, phone: '+972509876543', displayName: 'New profile',
    name: 'Hijacked global name', permissionLevel: 'MANAGER', active: 'true',
  })));
  assert.equal(denied.ok, false);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } }), beforeUser);
  const allowed = await inRequest(cookie, () => saveStaffAction({ ok: false, mode: 'edit' }, form({
    id: staff.id, phone: beforeUser.phone!, displayName: 'Local profile',
    name: 'Must not replace global name', permissionLevel: 'MANAGER', active: 'true',
  })));
  assert.equal(allowed.ok, true);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } }), beforeUser);
  assert.equal((await prisma.staffMember.findUniqueOrThrow({ where: { id: staff.id } })).displayName, 'Local profile');
});

test('adding a staff profile cannot overwrite the existing global identity name', async () => {
  await prisma.user.update({
    where: { id: victimUserId }, data: { phone: '+972506664455', name: 'Verified global name' },
  });
  const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: victimUserId } });
  const result = await inRequest(await ownerCookie(ownerEmail), () => saveStaffAction(
    { ok: false, mode: 'add' }, form({
      phone: beforeUser.phone!, name: 'Poisoned global name', displayName: 'Tenant alias',
      permissionLevel: 'CALENDAR_ONLY', active: 'true',
    }),
  ));
  assert.equal(result.ok, true);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: victimUserId } }), beforeUser);
});

test('POS links reject foreign tenant clients, staff and appointments', async () => {
  const cookie = await ownerCookie(ownerEmail);
  const sale = await prisma.sale.create({ data: { businessId: business.id } });
  const otherClient = await prisma.client.create({
    data: { businessId: otherBusiness.id, name: 'Other client' },
  });
  const otherStaff = await prisma.staffMember.create({
    data: { businessId: otherBusiness.id, userId: staff.userId, displayName: 'Other staff' },
  });
  const otherAppointment = await prisma.appointment.create({
    data: {
      businessId: otherBusiness.id, clientId: otherClient.id, staffId: otherStaff.id,
      startAt: new Date(Date.now() + 3600000), endAt: new Date(Date.now() + 5400000),
      totalPriceAgorot: 0,
    },
  });
  for (const link of [
    { clientId: otherClient.id }, { staffId: otherStaff.id }, { appointmentId: otherAppointment.id },
  ]) {
    await inRequest(cookie, () => setSaleLinksAction(form({ saleId: sale.id, ...link })));
    const unchanged = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    assert.equal(unchanged.clientId, null);
    assert.equal(unchanged.staffId, null);
    assert.equal(unchanged.appointmentId, null);
  }
  await inRequest(cookie, () => setSaleLinksAction(form({
    saleId: sale.id, clientId: victim.id, staffId: staff.id, appointmentId: victimAppointmentId,
  })));
  const linked = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
  assert.equal(linked.clientId, victim.id);
  assert.equal(linked.staffId, staff.id);
  assert.equal(linked.appointmentId, victimAppointmentId);
});

function registrationEmail(label: string): string {
  const email = `${prefix}-${label}@example.test`;
  registrationEmails.push(email);
  return email;
}

test('only platform admin can provision a customer; creation sends no verification and enters onboarding', async () => {
  const email = registrationEmail('provision-action');
  const fd = form({ name: `${prefix}-prepared`, type: 'BARBERSHOP', email, phone: '+972509003101' });
  for (const cookie of ['', await ownerCookie(ownerEmail), clientCookie(attackerUserId)]) {
    await assert.rejects(inRequest(cookie, () => provisionBusinessAction({}, fd)), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
  assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 0);
  assert.ok((await inRequest(await ownerCookie(adminEmail), () => provisionBusinessAction({}, form({
    name: 'Invalid', type: 'OTHER',
  })))).error);
  await assert.rejects(
    inRequest(await ownerCookie(adminEmail), () => provisionBusinessAction({}, fd)),
    (error: unknown) => {
      assert.ok(error instanceof Error && 'digest' in error);
      assert.match(String(error.digest), /NEXT_REDIRECT;replace;\/admin\/onboarding;307/);
      return true;
    },
  );
  const prepared = await prisma.business.findFirstOrThrow({ where: { ownerEmail: email } });
  assert.equal(prepared.provisionedBy, adminEmail);
  assert.equal(prepared.ownerPhoneIdentity, ownerEmailForPhone('+972509003101'));
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.emailVerified, null);
  assert.equal(user.phone, null);
  assert.equal(user.phoneVerifiedAt, null);
  assert.equal(await prisma.otpCode.count({ where: { phone: { in: [email, '+972509003101'] } } }), 0);
  assert.equal(await prisma.messageLog.count({ where: { businessId: prepared.id } }), 0);
});

test('either verified owner login reaches the same prepared business and client login does not', async () => {
  const email = registrationEmail('provision-both');
  const phone = '+972509003102';
  const phoneIdentity = ownerEmailForPhone(phone)!;
  const prepared = await createBusiness({
    name: `${prefix}-both`, ownerEmail: email, phone,
    provisioning: { adminEmail, phoneIdentity },
  });
  for (const identity of [email.toUpperCase(), phoneIdentity]) {
    const cookie = await ownerCookie(identity);
    assert.equal((await inRequest(cookie, () => getActiveBusiness()))?.id, prepared.id);
    assert.deepEqual((await getBusinessesOwnedByEmail(identity)).map((b) => b.id), [prepared.id]);
    assert.equal((await inRequest(cookie, () => saveAllSettingsAction({ ok: false }, settingsForm('Prepared by admin')))).ok, true);
    assert.equal((await createBusiness({ ownerEmail: identity, name: 'Stale signup form' })).id, prepared.id);
  }
  assert.equal(await inRequest(clientCookie(attackerUserId, email, phone), () => getActiveBusiness()), null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified, null);
  assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 1);
  await prisma.business.update({ where: { id: prepared.id }, data: { phone: '+972509003199' } });
  assert.equal((await inRequest(await ownerCookie(phoneIdentity), () => getActiveBusiness()))?.id, prepared.id);
  assert.equal(await inRequest(await ownerCookie(ownerEmailForPhone('+972509003199')!), () => getActiveBusiness()), null);
  await prisma.business.update({ where: { id: prepared.id }, data: { accountStatus: 'PENDING_DELETION' } });
  assert.equal(await inRequest(await ownerCookie(phoneIdentity), () => getActiveBusiness()), null);
  assert.equal((await inRequest(await ownerCookie(phoneIdentity), () => getActiveBusiness({ allowInactive: true })))?.id, prepared.id);
});

test('phone-only and email-only provisioning preserve normal owner login and seed existing onboarding', async () => {
  const phoneIdentity = ownerEmailForPhone('+972509003103')!;
  registrationEmails.push(phoneIdentity);
  for (const email of [registrationEmail('provision-email'), phoneIdentity]) {
    const prepared = await createBusiness({
      ownerEmail: email, name: `${prefix}-${email === phoneIdentity ? 'phone' : 'email'}`,
      provisioning: { adminEmail, phoneIdentity: email === phoneIdentity ? phoneIdentity : null },
    });
    const seeded = await prisma.business.findUniqueOrThrow({
      where: { id: prepared.id }, include: { staff: true, services: true, workingHours: true, settings: true },
    });
    assert.ok(seeded.staff.length && seeded.services.length && seeded.workingHours.length && seeded.settings);
    assert.equal((await inRequest(await ownerCookie(email), () => getActiveBusiness()))?.id, prepared.id);
  }
});

test('concurrent provisioning is idempotent and refuses mismatched existing owner identities', async () => {
  const email = registrationEmail('provision-race');
  const phoneIdentity = ownerEmailForPhone('+972509003104')!;
  const input = { ownerEmail: email, name: `${prefix}-provision-race`, provisioning: { adminEmail, phoneIdentity } };
  const prepared = await Promise.all([createBusiness(input), createBusiness(input)]);
  assert.equal(prepared[0].id, prepared[1].id);
  const ledger = await prisma.trialLedger.findUniqueOrThrow({ where: { emailHash: computeTrialHashes(email, null).emailHash } });
  assert.equal(ledger.registrationCount, 1);
  const otherEmail = registrationEmail('provision-conflict');
  await assert.rejects(createBusiness({ ...input, ownerEmail: otherEmail }), BusinessIdentityConflictError);
  await assert.rejects(createBusiness({ ...input, ownerEmail }), BusinessIdentityConflictError);
  assert.equal(await prisma.user.count({ where: { email: otherEmail } }), 0);
  assert.equal(await prisma.business.count({ where: { ownerPhoneIdentity: phoneIdentity } }), 1);
});

test('simultaneous self-signup and provisioning cannot create duplicate ownership', async () => {
  const email = registrationEmail('provision-vs-signup');
  const phoneIdentity = ownerEmailForPhone('+972509003105')!;
  const outcomes = await Promise.allSettled([
    createBusiness({ ownerEmail: email, name: `${prefix}-self-signup` }),
    createBusiness({ ownerEmail: email, name: `${prefix}-admin-signup`, provisioning: { adminEmail, phoneIdentity } }),
  ]);
  assert.equal(outcomes[0].status, 'fulfilled');
  if (outcomes[1].status === 'rejected') assert.ok(outcomes[1].reason instanceof BusinessIdentityConflictError);
  assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 1);
});

test('an explicit ownership transfer revokes the old provisioned phone without changing other users', async () => {
  const email = registrationEmail('provision-transfer');
  const replacement = registrationEmail('provision-replacement');
  const phoneIdentity = ownerEmailForPhone('+972509003106')!;
  const prepared = await createBusiness({
    ownerEmail: email, name: `${prefix}-transfer`, provisioning: { adminEmail, phoneIdentity },
  });
  await inRequest(await ownerCookie(adminEmail), () => editBusinessDetailsAction(form({
    businessId: prepared.id, name: prepared.name, ownerEmail: replacement, phone: '', planNotes: '',
  })));
  assert.equal(await inRequest(await ownerCookie(phoneIdentity), () => getActiveBusiness()), null);
  assert.equal(await inRequest(await ownerCookie(email), () => getActiveBusiness()), null);
  assert.equal((await inRequest(await ownerCookie(replacement), () => getActiveBusiness()))?.id, prepared.id);
});

test('onboarding atomically seeds an immediately bookable eligible basic trial', async () => {
  const email = registrationEmail('new-owner');
  const created = await createBusiness({
    ownerEmail: email.toUpperCase(), ownerName: 'Owner', name: `${prefix}-new`,
    priorCalendar: 'paper', referralSource: 'search',
  });
  assert.equal(created.ownerEmail, email);
  assert.equal(created.plan, 'basic');
  assert.equal(getBusinessAccess(created).state, 'trialing');
  assert.equal(created.priorCalendar, 'paper');
  assert.equal(created.referralSource, 'search');
  assert.ok(created.settings);
  const seeded = await prisma.business.findUniqueOrThrow({
    where: { id: created.id }, include: { workingHours: true, staff: true, services: true },
  });
  assert.equal(seeded.workingHours.length, 5);
  assert.equal(seeded.staff.length, 1);
  assert.ok(seeded.services.length > 0);
  assert.equal(await prisma.serviceStaff.count({ where: { staffId: seeded.staff[0].id } }), seeded.services.length);
  const ledger = await prisma.trialLedger.findUniqueOrThrow({
    where: { emailHash: computeTrialHashes(email, null).emailHash },
  });
  assert.equal(created.trialEndsAt?.getTime(), ledger.originalTrialEndsAt.getTime());
  assert.equal((await inRequest(await ownerCookie(email.toUpperCase()), () => getActiveBusiness()))?.id, created.id);
  const edited = await inRequest(await ownerCookie(email), () => saveStaffAction(
    { ok: false, mode: 'edit' }, form({
      id: seeded.staff[0].id, phone: '', displayName: 'Local owner profile',
      permissionLevel: 'MANAGER', active: 'true',
    }),
  ));
  assert.equal(edited.ok, true, 'email-only owner staff can edit tenant-local fields without claiming a phone');
});

test('database seed rejection rolls back business, owner and trial allocation together', async () => {
  const email = registrationEmail('seed-failure');
  const constraint = `seed_failure_${randomUUID().replaceAll('-', '')}`;
  const ownerName = `${prefix}-seed-failure`;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "StaffMember" ADD CONSTRAINT "${constraint}" CHECK ("displayName" <> '${ownerName}')`,
  );
  try {
    await assert.rejects(createBusiness({ ownerEmail: email, ownerName, name: `${prefix}-failed` }));
    assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 0);
    assert.equal(await prisma.user.count({ where: { email } }), 0);
    assert.equal(await prisma.trialLedger.count({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    }), 0);
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "StaffMember" DROP CONSTRAINT "${constraint}"`);
  }
  const retry = await createBusiness({ ownerEmail: email, name: `${prefix}-retry` });
  assert.equal(getBusinessAccess(retry).state, 'trialing');
});

test('concurrent registration cannot exceed owner quota or extend the original trial', async () => {
  const email = registrationEmail('quota');
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
    createBusiness({
      ownerEmail: index % 2 ? email.toUpperCase() : email, name: `${prefix}-quota-${index}`,
    }),
  ));
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  assert.equal(fulfilled.length, MAX_BUSINESSES_PER_OWNER);
  for (const result of results) {
    if (result.status === 'rejected') assert.ok(result.reason instanceof BusinessCreationLimitError);
  }
  assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), MAX_BUSINESSES_PER_OWNER);
  const ledger = await prisma.trialLedger.findUniqueOrThrow({
    where: { emailHash: computeTrialHashes(email, null).emailHash },
  });
  assert.equal(ledger.registrationCount, MAX_BUSINESSES_PER_OWNER);
  for (const result of fulfilled) assert.equal(result.value.trialEndsAt?.getTime(), ledger.originalTrialEndsAt.getTime());

  const pending = fulfilled[0].value;
  await prisma.business.update({
    where: { id: pending.id }, data: {
      accountStatus: 'PENDING_DELETION', phone: '+972501112233',
      purgeScheduledFor: new Date(Date.now() + 86400000),
    },
  });
  await assert.rejects(createBusiness({ ownerEmail: email, name: 'Cannot bypass quota' }), BusinessCreationLimitError);
  const restored = await createBusiness({ ownerEmail: email, name: 'Recovery', phone: '+972501112233' });
  assert.equal(restored.id, pending.id);
  assert.equal(restored.accountStatus, 'ACTIVE');
  assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), MAX_BUSINESSES_PER_OWNER);
  assert.equal(restored.trialEndsAt?.getTime(), ledger.originalTrialEndsAt.getTime());
});

test('expired registration history never receives a renewed trial', async () => {
  const email = registrationEmail('expired-trial');
  const originalTrialEndsAt = new Date(Date.now() - 86400000);
  await prisma.trialLedger.create({
    data: { ...computeTrialHashes(email, null), originalTrialEndsAt },
  });
  const created = await createBusiness({ ownerEmail: email, name: `${prefix}-expired` });
  assert.equal(created.trialEndsAt?.getTime(), originalTrialEndsAt.getTime());
  assert.equal(created.subscriptionStatus, 'expired');
  assert.equal(getBusinessAccess(created).active, false);
});

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('phone OTP stamps phone ownership only after success, including existing unverified staff users', async () => {
  const phone = '+972509001101';
  verifiedPhones.push(phone);
  otpIdentities.push(phone);
  const unverified = await prisma.user.create({ data: { phone, name: 'Unverified staff', role: 'STAFF' } });
  const code = await createOtp(phone);
  const denied = await inRequest('', () => verifyPhoneOtp(jsonRequest({
    phone, code: code === '000000' ? '111111' : '000000',
  })));
  assert.equal(denied.status, 401);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } })).phoneVerifiedAt, null);
  const accepted = await inRequest('', () => verifyPhoneOtp(jsonRequest({ phone, code })));
  assert.equal(accepted.status, 200);
  const verified = await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } });
  assert.ok(verified.phoneVerifiedAt);
  assert.equal(verified.role, 'STAFF');
  assert.equal((await inRequest('', () => verifyPhoneOtp(jsonRequest({ phone, code })))).status, 401);
});

test('email OTP stamps email verification only after success', async () => {
  const email = registrationEmail('email-otp');
  otpIdentities.push(email);
  const unverified = await prisma.user.create({ data: { email } });
  const code = await createOtp(email);
  const denied = await inRequest('', () => verifyEmailOtp(jsonRequest({
    email, code: code === '000000' ? '111111' : '000000',
  })));
  assert.equal(denied.status, 401);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } })).emailVerified, null);
  const accepted = await inRequest('', () => verifyEmailOtp(jsonRequest({ email: email.toUpperCase(), code })));
  assert.equal(accepted.status, 200);
  assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } })).emailVerified);
});

test('Firebase verified phone creates a verified user; invalid tokens cannot create one', async () => {
  const phone = '+972509001102';
  verifiedPhones.push(phone);
  let lookups = 0;
  // Firebase SDK emulator verification also fetches the account's revocation state.
  const emulator = createServer((request, response) => {
    if (request.method !== 'POST' || !request.url?.endsWith('/accounts:lookup')) {
      response.writeHead(404).end();
      return;
    }
    lookups++;
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      users: [{ localId: `${prefix}-firebase`, phoneNumber: phone, validSince: '0', disabled: false }],
    }));
  });
  await new Promise<void>((resolve) => emulator.listen(0, '127.0.0.1', resolve));
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${(emulator.address() as AddressInfo).port}`;
  try {
    const denied = await inRequest('', () => verifyFirebasePhone(jsonRequest({
      idToken: 'invalid-token-that-is-not-a-jwt',
    })));
    assert.equal(denied.status, 401);
    assert.equal(await prisma.user.count({ where: { phone } }), 0);
    const now = Math.floor(Date.now() / 1000);
    const encodePart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const idToken = `${encodePart({ alg: 'none', typ: 'JWT' })}.${encodePart({
      aud: process.env.FIREBASE_PROJECT_ID, iss: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
      sub: `${prefix}-firebase`, iat: now, exp: now + 3600, auth_time: now,
      phone_number: phone, firebase: { sign_in_provider: 'phone' },
    })}.`;
    const accepted = await inRequest('', () => verifyFirebasePhone(jsonRequest({ idToken })));
    assert.equal(accepted.status, 200);
    assert.ok(lookups > 0);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    assert.ok(user.phoneVerifiedAt);
    assert.equal(user.phone, phone);
  } finally {
    await new Promise<void>((resolve, reject) => emulator.close((error) => error ? reject(error) : resolve()));
  }
});
