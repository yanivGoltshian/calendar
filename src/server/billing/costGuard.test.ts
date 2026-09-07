import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { resolveMessagingProvider } from '../providers/messaging';

import {
  resolveCostGuardConfig,
  monthStartUtc,
  evaluateGuard,
  getMonthlyPaidUsageAgorot,
  sendGuardedSms,
  type CostGuardConfig,
  type GuardedSmsDeps,
} from './costGuard';

const CONFIG: CostGuardConfig = {
  capAgorot: 4500,
  alertAgorot: 4000,
  unitCostAgorot: 10,
};

// ---------- resolveCostGuardConfig ----------

test('resolveCostGuardConfig: ברירות מחדל 4500/4000/10', () => {
  const cfg = resolveCostGuardConfig({});
  assert.deepEqual(cfg, { capAgorot: 4500, alertAgorot: 4000, unitCostAgorot: 10 });
});

test('resolveCostGuardConfig: כוונון דרך משתני סביבה', () => {
  const cfg = resolveCostGuardConfig({
    SMS_MONTHLY_CAP_AGOROT: '9000',
    SMS_MONTHLY_ALERT_AGOROT: '8000',
    SMS_UNIT_COST_AGOROT: '25',
  });
  assert.deepEqual(cfg, { capAgorot: 9000, alertAgorot: 8000, unitCostAgorot: 25 });
});

test('resolveCostGuardConfig: סף התראה נכפה שלא יעבור את התקרה', () => {
  const cfg = resolveCostGuardConfig({
    SMS_MONTHLY_CAP_AGOROT: '3000',
    SMS_MONTHLY_ALERT_AGOROT: '9000',
  });
  assert.equal(cfg.alertAgorot, 3000);
});

test('resolveCostGuardConfig: קלט לא תקין נופל לברירת מחדל', () => {
  const cfg = resolveCostGuardConfig({
    SMS_MONTHLY_CAP_AGOROT: 'abc',
    SMS_MONTHLY_ALERT_AGOROT: '-5',
    SMS_UNIT_COST_AGOROT: '',
  });
  assert.deepEqual(cfg, { capAgorot: 4500, alertAgorot: 4000, unitCostAgorot: 10 });
});

// ---------- monthStartUtc ----------

test('monthStartUtc: מחזיר את תחילת החודש ב-UTC', () => {
  const start = monthStartUtc(new Date('2026-03-17T09:30:00.000Z'));
  assert.equal(start.toISOString(), '2026-03-01T00:00:00.000Z');
});

// ---------- evaluateGuard ----------

test('evaluateGuard: מתחת לכל הספים — עובר בלי התראה', () => {
  const d = evaluateGuard(1000, 10, CONFIG);
  assert.equal(d.blocked, false);
  assert.equal(d.crossesAlert, false);
});

test('evaluateGuard: חציית סף ההתראה מסמנת crossesAlert', () => {
  const d = evaluateGuard(3995, 10, CONFIG);
  assert.equal(d.blocked, false);
  assert.equal(d.crossesAlert, true);
});

test('evaluateGuard: מתחת לסף ההתראה בדיוק — לא חוצה עדיין', () => {
  const d = evaluateGuard(3980, 10, CONFIG);
  assert.equal(d.crossesAlert, false);
});

test('evaluateGuard: כבר מעל סף ההתראה — לא נספר כחצייה חוזרת', () => {
  const d = evaluateGuard(4200, 10, CONFIG);
  assert.equal(d.crossesAlert, false);
  assert.equal(d.blocked, false);
});

test('evaluateGuard: בתקרה בדיוק — נחסם', () => {
  const d = evaluateGuard(4500, 10, CONFIG);
  assert.equal(d.blocked, true);
});

test('evaluateGuard: מעל התקרה — נחסם', () => {
  const d = evaluateGuard(4600, 10, CONFIG);
  assert.equal(d.blocked, true);
});

// ---------- getMonthlyPaidUsageAgorot ----------

test('getMonthlyPaidUsageAgorot: מסנן לפי עסק, ספירת-תקרה, וחודש נוכחי', async () => {
  let captured: any = null;
  const prismaClient = {
    messageLog: {
      aggregate: async (args: any) => {
        captured = args;
        return { _sum: { costAgorot: 320 } };
      },
    },
  } as any;
  const used = await getMonthlyPaidUsageAgorot('biz-1', {
    now: new Date('2026-05-10T00:00:00.000Z'),
    prismaClient,
  });
  assert.equal(used, 320);
  assert.equal(captured.where.businessId, 'biz-1');
  assert.equal(captured.where.countsToCap, true);
  assert.equal(
    captured.where.createdAt.gte.toISOString(),
    '2026-05-01T00:00:00.000Z',
  );
});

test('getMonthlyPaidUsageAgorot: סכום ריק מוחזר כאפס', async () => {
  const prismaClient = {
    messageLog: { aggregate: async () => ({ _sum: { costAgorot: null } }) },
  } as any;
  const used = await getMonthlyPaidUsageAgorot('biz-1', { prismaClient });
  assert.equal(used, 0);
});

// ---------- sendGuardedSms ----------

type Logged = {
  status: string;
  costAgorot: number;
  countsToCap: boolean;
  error?: string | null;
};

function makeDeps(
  used: number,
  overrides: Partial<GuardedSmsDeps> = {},
): {
  deps: GuardedSmsDeps;
  sent: string[];
  logs: Logged[];
  alerts: { count: number };
} {
  const sent: string[] = [];
  const logs: Logged[] = [];
  const alerts = { count: 0 };
  const db = {
    $executeRaw: async () => 1,
    business: { findUnique: async () => ({ plan: 'exclusive', paidUntil: new Date(Date.now() + 86400000), accountStatus: 'ACTIVE' }) },
    client: { findFirst: async () => ({ id: 'client', identityVerifiedAt: new Date(), user: { phone: '+972500000000', phoneVerifiedAt: new Date() } }) },
    messageLog: {
      findUnique: async () => null,
      aggregate: async () => ({ _sum: { costAgorot: used } }),
      count: async () => 0,
      create: async ({ data }: { data: Logged }) => { logs.push({ ...data }); return { id: 'reserved' }; },
      update: async ({ data }: { data: Partial<Logged> }) => { Object.assign(logs[0], data); return { id: 'reserved' }; },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  } as unknown as PrismaClient;
  const deps: GuardedSmsDeps = {
    config: CONFIG,
    now: new Date('2026-06-15T00:00:00.000Z'),
    prismaClient: db,
    sendSms: async (to) => {
      sent.push(to);
    },
    onAlert: async () => {
      alerts.count += 1;
    },
    ...overrides,
  };
  return { deps, sent, logs, alerts };
}

test('sendGuardedSms: מתחת לתקרה — שולח ומתעד SENT עם עלות', async () => {
  const { deps, sent, logs } = makeDeps(1000);
  const res = await sendGuardedSms(
    { businessId: 'b', to: '+972500000000', body: 'hi' },
    deps,
  );
  assert.deepEqual(res, { status: 'sent', costAgorot: 10, crossedAlert: false });
  assert.deepEqual(sent, ['+972500000000']);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'SENT');
  assert.equal(logs[0].costAgorot, 10);
  assert.equal(logs[0].countsToCap, true);
});

test('sendGuardedSms: חציית סף ההתראה — שולח ומפעיל התראה אחת', async () => {
  const { deps, sent, alerts } = makeDeps(3995);
  const res = await sendGuardedSms(
    { businessId: 'b', to: '+972500000000', body: 'hi' },
    deps,
  );
  assert.equal(res.status, 'sent');
  assert.equal((res as { crossedAlert: boolean }).crossedAlert, true);
  assert.equal(alerts.count, 1);
  assert.equal(sent.length, 1);
});

test('sendGuardedSms: בתקרה — חוסם, מתעד BLOCKED, ולא שולח', async () => {
  const { deps, sent, logs, alerts } = makeDeps(4500);
  const res = await sendGuardedSms(
    { businessId: 'b', to: '+972500000000', body: 'hi' },
    deps,
  );
  assert.equal(res.status, 'blocked');
  assert.equal((res as { usedAgorot: number }).usedAgorot, 4500);
  assert.equal((res as { capAgorot: number }).capAgorot, 4500);
  assert.equal(sent.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'BLOCKED');
  assert.equal(logs[0].costAgorot, 0);
  assert.equal(alerts.count, 0);
});

test('sendGuardedSms refuses a caller-controlled budget exemption', async () => {
  const { deps, sent, logs, alerts } = makeDeps(9999);
  const res = await sendGuardedSms(
    {
      businessId: 'b',
      to: '+972500000000',
      body: 'owner code',
      countsToCap: false,
    },
    deps,
  );
  assert.equal(res.status, 'blocked');
  assert.equal(sent.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'BLOCKED');
  assert.equal(logs[0].countsToCap, true);
  assert.equal(alerts.count, 0);
});

test('production console provider never finalizes a reservation as SENT', async () => {
  const { deps, logs } = makeDeps(1000, {
    sendSms: async (to, body) => {
      await resolveMessagingProvider({ NODE_ENV: 'production', MESSAGING_PROVIDER: 'console' }).sendSms(to, body);
    },
  });
  const res = await sendGuardedSms(
    { businessId: 'b', to: '+972500000000', body: 'hi' },
    deps,
  );
  assert.equal(res.status, 'failed');
  assert.equal((res as { error: string }).error, 'provider_not_configured');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'FAILED');
  assert.equal(logs[0].costAgorot, 0);
});

test('sendGuardedSms: איפוס בתחילת חודש — צבירה של חודש קודם אינה חוסמת', async () => {
  // הצבירה נמדדת בחלון החודש הנוכחי בלבד; getUsage מדמה חודש חדש (0).
  const { deps, sent } = makeDeps(0);
  const res = await sendGuardedSms(
    { businessId: 'b', to: '+972500000000', body: 'hi' },
    deps,
  );
  assert.equal(res.status, 'sent');
  assert.equal(sent.length, 1);
});

test('projected spend cannot cross the cap', () => {
  assert.equal(evaluateGuard(4495, 10, CONFIG).blocked, true);
});

test('storage failure before reservation never dispatches', async () => {
  const { deps, sent } = makeDeps(0, {
    prismaClient: { $transaction: async () => { throw new Error('database offline'); } } as unknown as PrismaClient,
  });
  assert.deepEqual(await sendGuardedSms({ businessId: 'b', to: '+972500000000', body: 'hi' }, deps), {
    status: 'failed', error: 'reservation_failed',
  });
  assert.equal(sent.length, 0);
});
