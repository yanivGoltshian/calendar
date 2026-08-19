import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import { handleCampaignCron, type CampaignCronDeps } from './handler';
import type { SendCampaignResult } from '@/server/repos/marketing';

/**
 * בדיקות יחידה למטפל ה-cron של הקמפיינים המתוזמנים. משתמשות בהזרקת תלויות
 * (CampaignCronDeps) ולכן אינן נוגעות ב-DB אמיתי. הדגש (זהה ל-cron התזכורות):
 * כשל DB/ריצה מחזיר 200 "מנוון" (degraded) עם קוד שגיאה בטוח, כדי שהטריגר המתוזמן
 * (שמכשיל על כל דבר שאינו 200) יפסיק לשלוח מיילי תקלה בלי להסתיר את שורש הבעיה.
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
  return new Request('https://torchick.test/api/cron/campaigns', {
    method: 'POST',
    headers,
  });
}

// שורת קמפיין מינימלית — רק השדות שהמטפל קורא בפועל (id + businessId).
const oneDueCampaign = { id: 'camp-1', businessId: 'biz-1' };

type DepsOverride = Partial<CampaignCronDeps>;

function makeDeps(overrides: DepsOverride = {}): CampaignCronDeps {
  return {
    getDueScheduledCampaigns:
      (async () => []) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
    sendCampaign: async (): Promise<SendCampaignResult> => ({
      ok: true,
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
    }),
    ...overrides,
  };
}

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
    getDueScheduledCampaigns: (async () => {
      calls += 1;
      throw knownError('P2024');
    }) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
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
    skipped: 0,
    alreadyClaimed: 0,
    recipients: 0,
    messagesSent: 0,
    messagesFailed: 0,
  });
  // כשל חולף → ניסיון חוזר בודד → נקרא פעמיים.
  assert.equal(calls, 2);
});

test('ניסיון חוזר מצליח בפעם השנייה → 200 תקין (ok:true)', async () => {
  setSecret(SECRET);
  let calls = 0;
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => {
      calls += 1;
      if (calls === 1) throw knownError('P1001');
      return [];
    }) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.degraded, undefined);
  assert.equal(calls, 2);
});

test('מסלול תקין ללא קמפיינים → 200 ok:true, found:0', async () => {
  setSecret(SECRET);
  const res = await handleCampaignCron(reqWith(SECRET), makeDeps());
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.degraded, undefined);
  assert.deepEqual(body.counts, {
    found: 0,
    sent: 0,
    skipped: 0,
    alreadyClaimed: 0,
    recipients: 0,
    messagesSent: 0,
    messagesFailed: 0,
  });
});

test('מסלול תקין עם קמפיין אחד → נשלח ונספר (sent + נמענים + הודעות)', async () => {
  setSecret(SECRET);
  const sentTo: Array<{ businessId: string; id: string }> = [];
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => [
      oneDueCampaign,
    ]) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
    sendCampaign: async (businessId, id): Promise<SendCampaignResult> => {
      sentTo.push({ businessId, id });
      return { ok: true, recipientCount: 3, sentCount: 5, failedCount: 1 };
    },
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.deepEqual(sentTo, [{ businessId: 'biz-1', id: 'camp-1' }]);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 1,
    skipped: 0,
    alreadyClaimed: 0,
    recipients: 3,
    messagesSent: 5,
    messagesFailed: 1,
  });
});

test('קמפיין ללא נמענים → מדולג (skipped), הריצה לא נכשלת', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => [
      oneDueCampaign,
    ]) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
    sendCampaign: async (): Promise<SendCampaignResult> => ({
      ok: false,
      reason: 'no_recipients',
    }),
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 0,
    skipped: 1,
    alreadyClaimed: 0,
    recipients: 0,
    messagesSent: 0,
    messagesFailed: 0,
  });
});

test('קמפיין שכבר נתפס (already_sent) → alreadyClaimed, מונע כפילות', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => [
      oneDueCampaign,
    ]) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
    sendCampaign: async (): Promise<SendCampaignResult> => ({
      ok: false,
      reason: 'already_sent',
    }),
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 0,
    skipped: 0,
    alreadyClaimed: 1,
    recipients: 0,
    messagesSent: 0,
    messagesFailed: 0,
  });
});

test('סוד שגוי → 401 unauthorized, בלי לגעת ב-DB', async () => {
  setSecret(SECRET);
  let called = false;
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => {
      called = true;
      return [];
    }) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
  });

  const res = await handleCampaignCron(reqWith('wrong-secret'), deps);
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
    const res = await handleCampaignCron(reqWith('anything'), makeDeps());
    assert.equal(res.status, 500);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.ok, false);
    assert.equal(body.error, 'cron_secret_unset');
  } finally {
    setSecret(prev);
  }
});

test('כשל DB באמצע הלולאה (sendCampaign) → 200 מנוון עם ספירה חלקית', async () => {
  setSecret(SECRET);
  const deps = makeDeps({
    getDueScheduledCampaigns: (async () => [
      oneDueCampaign,
    ]) as unknown as CampaignCronDeps['getDueScheduledCampaigns'],
    sendCampaign: async () => {
      throw knownError('P2022'); // סחף סכימה — לא חולף, לא מנסים שוב
    },
  });

  const res = await handleCampaignCron(reqWith(SECRET), deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.degraded, true);
  assert.equal(body.code, 'P2022');
  // נמצא קמפיין אחד, אך אף אחד לא נשלח כי הכשל קרה לפני הספירה.
  assert.deepEqual(body.counts, {
    found: 1,
    sent: 0,
    skipped: 0,
    alreadyClaimed: 0,
    recipients: 0,
    messagesSent: 0,
    messagesFailed: 0,
  });
});
