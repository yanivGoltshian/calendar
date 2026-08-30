import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import { handleReminderCron, type ReminderDeps } from './handler';
import type { SendReminderResult } from '@/server/reminders/send';

/**
 * בדיקות יחידה למטפל ה-cron של התזכורות. משתמשות בהזרקת תלויות (ReminderDeps)
 * ולכן אינן נוגעות ב-DB אמיתי. הדגש: כשל DB/ריצה מחזיר 200 "מנוון" (degraded)
 * עם קוד שגיאה בטוח, כדי שהטריגר המתוזמן (שמכשיל על כל דבר שאינו 200) יפסיק
 * לשלוח מיילי תקלה, בלי להסתיר את שורש הבעיה.
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
  return new Request('https://torchick.test/api/cron/reminders', {
    method: 'POST',
    headers,
  });
}

// שורת תור מינימלית — רק השדות שהמטפל קורא בפועל. מוזרקת דרך ה-stub ולכן אין
// צורך בטיפוס Prisma המלא; ההמרה דרך unknown מגשרת בין Promise ל-PrismaPromise.
// startAt עתידי (שעה קדימה) כדי שהתור ייחשב בשל תחת הקדמת ברירת המחדל (24 שעות)
// לאחר חיווט reminderLeadHours: dueAt = startAt − 24h ≤ now, ו-startAt > now.
const oneDueRow = {
  id: 'appt-1',
  startAt: new Date(Date.now() + 60 * 60 * 1000),
  confirmToken: 'tok-1',
  business: {
    name: 'עסק לדוגמה',
    timezone: 'Asia/Jerusalem',
    settings: { reminderChannel: 'AUTO', reminderLeadHours: 24 },
  },
  client: { name: 'לקוח', phone: '+972500000000', email: null as string | null },
};

type DepsOverride = Partial<ReminderDeps>;

function makeDeps(overrides: DepsOverride = {}): ReminderDeps {
  return {
    getAppointmentsDueForReminder:
      (async () => []) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
    markReminderSent: async () => 1,
    sendReminder: async (): Promise<SendReminderResult> => ({
      status: 'skipped',
      reason: 'test',
    }),
    ...overrides,
  };
}

// בונה שורת תור לבדיקות בשלות פר-עסק: startAt במילישניות, זמן הקדמה בשעות, ומזהה.
// מאפשר לאמת שהמטפל שולח בדיוק בזמן ההקדמה של העסק ולא בחלון 24 שעות קשיח.
function rowAt(startAtMs: number, reminderLeadHours: number, id: string) {
  return {
    id,
    startAt: new Date(startAtMs),
    confirmToken: `tok-${id}`,
    business: {
      name: 'עסק לדוגמה',
      timezone: 'Asia/Jerusalem',
      settings: { reminderChannel: 'AUTO', reminderLeadHours },
    },
    client: { name: 'לקוח', phone: '+972500000000', email: null as string | null },
  };
}

const HOUR = 60 * 60 * 1000;

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`boom ${code}`, {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

test('כשל DB חולף (P2024) מחזיר 200 מנוון עם code, לאחר ניסיון חוזר', async () => {
  setSecret(SECRET);
  let calls = 0;
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => {
      calls += 1;
      throw knownError('P2024');
    }) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200); // חובה: 200 כדי שהמתזמן לא ישלח מייל תקלה
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.degraded, true);
  assert.equal(body.code, 'P2024');
  assert.equal(typeof body.message, 'string');
  assert.ok((body.message as string).length > 0);
  assert.deepEqual(body.counts, {
    found: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 0,
  });
  // כשל חולף → ניסיון חוזר בודד → נקרא פעמיים.
  assert.equal(calls, 2);
});

test('ניסיון חוזר מצליח בפעם השנייה → 200 תקין (ok:true)', async () => {
  setSecret(SECRET);
  let calls = 0;
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => {
      calls += 1;
      if (calls === 1) throw knownError('P1001');
      return [];
    }) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.degraded, undefined);
  assert.equal(calls, 2);
});

test('מסלול תקין ללא תורים → 200 ok:true, found:0', async () => {
  setSecret(SECRET);
  const res = await handleReminderCron(reqWith(SECRET), makeDeps());
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.degraded, undefined);
  assert.deepEqual(body.counts, {
    found: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 0,
  });
});

test('סוד שגוי → 401 unauthorized, בלי לגעת ב-DB', async () => {
  setSecret(SECRET);
  let called = false;
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => {
      called = true;
      return [];
    }) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
  });

  const res = await handleReminderCron(reqWith('wrong-secret'), deps);
  assert.equal(res.status, 401);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.error, 'unauthorized');
  assert.equal(called, false);
});

test('CRON_SECRET לא מוגדר → 500 cron_secret_unset (תקלת תצורה אמיתית)', async () => {
  const prev = process.env.CRON_SECRET;
  setSecret(undefined);
  try {
    const res = await handleReminderCron(reqWith('anything'), makeDeps());
    assert.equal(res.status, 500);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.ok, false);
    assert.equal(body.error, 'cron_secret_unset');
  } finally {
    setSecret(prev);
  }
});

test('כשל DB באמצע הלולאה (markReminderSent) → 200 מנוון עם ספירה חלקית', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => [
      oneDueRow,
    ]) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
    sendReminder: async (): Promise<SendReminderResult> => ({
      status: 'sent',
      channel: 'EMAIL',
    }),
    markReminderSent: async () => {
      throw knownError('P2022'); // סחף סכימה — לא חולף, לא מנסים שוב
    },
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.degraded, true);
  assert.equal(body.code, 'P2022');
  // נמצא תור אחד, אך אף אחד לא סומן כ-sent כי הכשל קרה לפני הספירה.
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 0,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 0,
  });
});

test('סלקטיביות בשלות: תור בשל נשלח ומסומן, תור לא-בשל מדולג בלי סימון', async () => {
  setSecret(SECRET);
  const now = Date.now();
  const ready = rowAt(now + 1 * HOUR, 24, 'ready'); // dueAt = now − 23h → בשל
  const notReady = rowAt(now + 6 * 24 * HOUR, 24, 'not-ready'); // dueAt = now + 5d → טרם בשל
  const sentIds: string[] = [];
  const markedIds: string[] = [];
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => [
      ready,
      notReady,
    ]) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
    sendReminder: (async (appt: { id: string }): Promise<SendReminderResult> => {
      sentIds.push(appt.id);
      return { status: 'sent', channel: 'EMAIL' };
    }) as unknown as ReminderDeps['sendReminder'],
    markReminderSent: (async (id: string) => {
      markedIds.push(id);
      return 1;
    }) as unknown as ReminderDeps['markReminderSent'],
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  // רק התור הבשל נשלח ומסומן; הלא-בשל לא נגע ב-sendReminder ולא ב-markReminderSent.
  assert.deepEqual(sentIds, ['ready']);
  assert.deepEqual(markedIds, ['ready']);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 1,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 1,
  });
});

test('הקדמת 48 שעות: תור ~48 שעות קדימה בשל, תור רחוק יותר טרם בשל', async () => {
  setSecret(SECRET);
  const now = Date.now();
  const due48 = rowAt(now + 47 * HOUR, 48, 'due-48'); // dueAt = now − 1h → בשל
  const early48 = rowAt(now + 49 * HOUR, 48, 'early-48'); // dueAt = now + 1h → טרם בשל
  const sentIds: string[] = [];
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => [
      due48,
      early48,
    ]) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
    sendReminder: (async (appt: { id: string }): Promise<SendReminderResult> => {
      sentIds.push(appt.id);
      return { status: 'sent', channel: 'EMAIL' };
    }) as unknown as ReminderDeps['sendReminder'],
    markReminderSent: async () => 1,
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  // ההקדמה של העסק (48 שעות) נכבדת: נשלח ~48 שעות לפני התור, לא 24.
  assert.deepEqual(sentIds, ['due-48']);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 1,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 1,
  });
});

test('הקדמת שעתיים: תור שעה קדימה בשל (מוכיח שאין עוד חלון 24 שעות קשיח)', async () => {
  setSecret(SECRET);
  const now = Date.now();
  const due2 = rowAt(now + 1 * HOUR, 2, 'due-2'); // dueAt = now − 1h → בשל
  const early2 = rowAt(now + 10 * HOUR, 2, 'early-2'); // dueAt = now + 8h → טרם בשל
  const sentIds: string[] = [];
  const deps = makeDeps({
    getAppointmentsDueForReminder: (async () => [
      due2,
      early2,
    ]) as unknown as ReminderDeps['getAppointmentsDueForReminder'],
    sendReminder: (async (appt: { id: string }): Promise<SendReminderResult> => {
      sentIds.push(appt.id);
      return { status: 'sent', channel: 'EMAIL' };
    }) as unknown as ReminderDeps['sendReminder'],
    markReminderSent: async () => 1,
  });

  const res = await handleReminderCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  // ההוכחה שאין עוד חלון 24 שעות קשיח: early-2 (10 שעות קדימה) היה נשלח תחת החוקה
  // הישנה (10<24), אך כעת מדולג כי הקדמת השעתיים טרם בשלה; רק due-2 נשלח.
  assert.deepEqual(sentIds, ['due-2']);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 1,
    failed: 0,
    skipped: 0,
    alreadyMarked: 0,
    notYetDue: 1,
  });
});
