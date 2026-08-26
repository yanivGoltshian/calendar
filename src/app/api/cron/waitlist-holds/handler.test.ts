import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import {
  handleWaitlistHoldsCron,
  type WaitlistHoldsDeps,
} from './handler';
import type { AutofillOutcome } from '@/server/waitlist/autofill';

/**
 * בדיקות יחידה למטפל ה-cron של פקיעת החזקות רשימת ההמתנה. משתמשות בהזרקת תלויות
 * (WaitlistHoldsDeps) ולכן אינן נוגעות ב-DB אמיתי. הדגש: פקיעה אטומית + הצעה חוזרת
 * לבא בתור לכל משבצת ייחודית שהתפנתה, וכשל DB מחזיר 200 "מנוון" (degraded) עם קוד
 * שגיאה בטוח כדי שהמתזמן לא ייכשל על blip חולף.
 */

const SECRET = 'test-cron-secret';
const CLIENT_VERSION = '6.19.3';

function setSecret(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = value;
  }
}

function reqWith(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request('https://torchick.test/api/cron/waitlist-holds', {
    method: 'POST',
    headers,
  });
}

function offeredOutcome(): AutofillOutcome {
  return {
    offered: true,
    entryId: 'entry-next',
    claimToken: 'tok-next',
    holdExpiresAt: new Date('2026-01-01T10:20:00.000Z'),
    send: { status: 'skipped', reason: 'test' },
  };
}

type DepsOverride = Partial<WaitlistHoldsDeps>;

function makeDeps(overrides: DepsOverride = {}): WaitlistHoldsDeps {
  return {
    findExpiredHolds: (async () => []) as WaitlistHoldsDeps['findExpiredHolds'],
    expireHeldEntry: async () => true,
    triggerWaitlistAutofillForAppointment: (async () =>
      offeredOutcome()) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
    ...overrides,
  };
}

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`boom ${code}`, {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

test('מסלול תקין ללא החזקות שפגו → 200 ok:true, expired:0', async () => {
  setSecret(SECRET);
  const res = await handleWaitlistHoldsCron(reqWith(SECRET), makeDeps());
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.expired, 0);
  assert.equal(body.reoffered, 0);
});

test('שתי החזקות שפגו על שתי משבצות → פוקעות ומוצעות מחדש (expired:2, reoffered:2)', async () => {
  setSecret(SECRET);
  const expireCalls: string[] = [];
  const reofferCalls: string[] = [];
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: 'appt-1' },
      { id: 'e2', businessId: 'b1', heldAppointmentId: 'appt-2' },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    expireHeldEntry: async (id: string) => {
      expireCalls.push(id);
      return true;
    },
    triggerWaitlistAutofillForAppointment: (async (appointmentId: string) => {
      reofferCalls.push(appointmentId);
      return offeredOutcome();
    }) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.expired, 2);
  assert.equal(body.reoffered, 2);
  assert.deepEqual(expireCalls, ['e1', 'e2']);
  assert.deepEqual(reofferCalls.sort(), ['appt-1', 'appt-2']);
});

test('שתי החזקות על אותה משבצת → הצעה חוזרת בודדת (dedupe לפי appointmentId)', async () => {
  setSecret(SECRET);
  const reofferCalls: string[] = [];
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: 'appt-1' },
      { id: 'e2', businessId: 'b1', heldAppointmentId: 'appt-1' },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    triggerWaitlistAutofillForAppointment: (async (appointmentId: string) => {
      reofferCalls.push(appointmentId);
      return offeredOutcome();
    }) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.expired, 2);
  assert.equal(reofferCalls.length, 1); // אותה משבצת → קריאה אחת בלבד
  assert.equal(body.reoffered, 1);
});

test('פקיעה שהפסידה מרוץ (expireHeldEntry=false) → לא נספרת ולא מוצעת מחדש', async () => {
  setSecret(SECRET);
  const reofferCalls: string[] = [];
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: 'appt-1' },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    expireHeldEntry: async () => false, // כבר טופל במקום אחר
    triggerWaitlistAutofillForAppointment: (async (appointmentId: string) => {
      reofferCalls.push(appointmentId);
      return offeredOutcome();
    }) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.expired, 0);
  assert.equal(body.reoffered, 0);
  assert.equal(reofferCalls.length, 0);
});

test('החזקה ללא heldAppointmentId → פוקעת אך אין הצעה חוזרת', async () => {
  setSecret(SECRET);
  const reofferCalls: string[] = [];
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: null },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    triggerWaitlistAutofillForAppointment: (async (appointmentId: string) => {
      reofferCalls.push(appointmentId);
      return offeredOutcome();
    }) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.expired, 1);
  assert.equal(body.reoffered, 0);
  assert.equal(reofferCalls.length, 0);
});

test('הצעה חוזרת שלא נמצא לה מועמד (offered:false) → נספרת פקיעה אך reoffered:0', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: 'appt-1' },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    triggerWaitlistAutofillForAppointment: (async () => ({
      offered: false,
      reason: 'no_match',
    })) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.expired, 1);
  assert.equal(body.reoffered, 0);
});

test('כשל בהצעה חוזרת בודדת אינו מפיל את הסֶווֹפ → 200 ok:true', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    findExpiredHolds: (async () => [
      { id: 'e1', businessId: 'b1', heldAppointmentId: 'appt-1' },
    ]) as WaitlistHoldsDeps['findExpiredHolds'],
    triggerWaitlistAutofillForAppointment: (async () => {
      throw new Error('offer boom');
    }) as WaitlistHoldsDeps['triggerWaitlistAutofillForAppointment'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.expired, 1);
  assert.equal(body.reoffered, 0);
});

test('סוד שגוי → 401 unauthorized, בלי לגעת ב-DB', async () => {
  setSecret(SECRET);
  let called = false;
  const deps = makeDeps({
    findExpiredHolds: (async () => {
      called = true;
      return [];
    }) as WaitlistHoldsDeps['findExpiredHolds'],
  });

  const res = await handleWaitlistHoldsCron(reqWith('wrong-secret'), deps);
  assert.equal(res.status, 401);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.error, 'unauthorized');
  assert.equal(called, false);
});

test('CRON_SECRET לא מוגדר → 500 cron_secret_unset', async () => {
  const prev = process.env.CRON_SECRET;
  setSecret(undefined);
  try {
    const res = await handleWaitlistHoldsCron(reqWith('anything'), makeDeps());
    assert.equal(res.status, 500);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.ok, false);
    assert.equal(body.error, 'cron_secret_unset');
  } finally {
    setSecret(prev);
  }
});

test('כשל DB ב-findExpiredHolds → 200 מנוון עם code', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    findExpiredHolds: (async () => {
      throw knownError('P2024');
    }) as WaitlistHoldsDeps['findExpiredHolds'],
  });

  const res = await handleWaitlistHoldsCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.degraded, true);
  assert.equal(body.code, 'P2024');
  assert.equal(body.expired, 0);
  assert.equal(body.reoffered, 0);
});
