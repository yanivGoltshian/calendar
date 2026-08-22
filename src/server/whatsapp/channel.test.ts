import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deliverWhatsApp,
  sendOtp,
  sendCampaign,
  type ChannelDeps,
  type WhatsAppBusinessRow,
  type WhatsAppPrismaLike,
} from '@/server/whatsapp/channel';
import { currentMonth } from '@/server/whatsapp/cost';
import type { WhatsAppConfig } from '@/server/whatsapp/config';
import type { AcsSendResult } from '@/server/whatsapp/acsTransport';

const NOW = new Date('2026-08-15T10:00:00Z');
const MONTH = currentMonth(NOW);
const VALID_PHONE = '0501234567';

function makeConfig(over: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    connectionString: 'endpoint=https://x;accesskey=k',
    channelId: 'chan-1',
    templates: { otp: 'otp_tpl', confirm: 'confirm_tpl', reminder: 'reminder_tpl' },
    templateLang: 'he',
    rates: { utility: 12, auth: 12, marketing: 12 },
    warnAgorot: 24,
    blockAgorot: 36,
    superAdminEmail: 'admin@example.com',
    ...over,
  };
}

function makeRow(over: Partial<WhatsAppBusinessRow> = {}): WhatsAppBusinessRow {
  return {
    id: 'biz-1',
    name: 'עסק בדיקה',
    plan: 'exclusive',
    ownerEmail: 'owner@example.com',
    monthlyWhatsappCostAgorot: 0,
    whatsappCostMonth: null,
    whatsappBlocked: false,
    whatsappWarn40SentForMonth: null,
    whatsappOverrideApprovedForMonth: null,
    ...over,
  };
}

interface Harness {
  deps: ChannelDeps;
  logs: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  templateCalls: Array<{ templateName: string; bodyParams?: string[] }>;
  textCalls: Array<{ text: string }>;
  alerts: { warn: number; block: number; owner: Array<{ blocked: boolean }> };
}

function build(opts: {
  row?: WhatsAppBusinessRow | null;
  config?: WhatsAppConfig;
  templateResult?: AcsSendResult;
  textResult?: AcsSendResult;
  findUniqueThrows?: boolean;
} = {}): Harness {
  const row = opts.row === undefined ? makeRow() : opts.row;
  const logs: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const templateCalls: Array<{ templateName: string; bodyParams?: string[] }> = [];
  const textCalls: Array<{ text: string }> = [];
  const alerts = { warn: 0, block: 0, owner: [] as Array<{ blocked: boolean }> };

  const prisma: WhatsAppPrismaLike = {
    business: {
      findUnique: async () => {
        if (opts.findUniqueThrows) throw new Error('db down');
        return row;
      },
      update: async ({ data }) => {
        updates.push(data);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    whatsAppMessageLog: {
      create: async ({ data }) => {
        logs.push(data);
        return { id: `log-${logs.length}` };
      },
    },
  };

  const deps: ChannelDeps = {
    prisma,
    config: opts.config ?? makeConfig(),
    now: () => NOW,
    sendTemplate: async (_c, p) => {
      templateCalls.push({ templateName: p.templateName, bodyParams: p.bodyParams });
      return opts.templateResult ?? { ok: true, providerMessageId: 'prov-1' };
    },
    sendText: async (_c, p) => {
      textCalls.push({ text: p.text });
      return opts.textResult ?? { ok: true, providerMessageId: 'prov-txt' };
    },
    alerts: {
      sendSuperAdminWarnEmail: async () => {
        alerts.warn += 1;
        return true;
      },
      sendSuperAdminBlockEmail: async () => {
        alerts.block += 1;
        return true;
      },
      sendOwnerUsageNoticeEmail: async (p) => {
        alerts.owner.push({ blocked: p.blocked });
        return true;
      },
    },
  };

  return { deps, logs, updates, templateCalls, textCalls, alerts };
}

test('חבילה שאינה Exclusive מדולגת ללא יומן וללא עלות, עם נפילה למייל', async () => {
  const h = build({ row: makeRow({ plan: 'premium' }) });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'skipped');
  assert.equal(res.errorCode, 'TIER_NO_WHATSAPP');
  assert.equal(res.emailFallback, true);
  assert.equal(res.costAgorot, 0);
  assert.equal(h.logs.length, 0);
  assert.equal(h.templateCalls.length, 0);
});

test('עסק שלא נמצא מדולג בשקט ללא יומן', async () => {
  const h = build({ row: null });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'missing',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'skipped');
  assert.equal(res.errorCode, 'BUSINESS_NOT_FOUND');
  assert.equal(h.logs.length, 0);
});

test('טלפון לא תקין נרשם ככשל, ללא קריאת ספק וללא עלות', async () => {
  const h = build();
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: '12345',
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'failed');
  assert.equal(res.errorCode, 'INVALID_PHONE');
  assert.equal(res.costAgorot, 0);
  assert.equal(h.templateCalls.length, 0);
  assert.equal(h.logs.length, 1);
  assert.equal(h.logs[0].status, 'FAILED');
});

test('כשל ספק אמיתי נרשם FAILED ואינו מחייב את העסק', async () => {
  const h = build({ templateResult: { ok: false, errorCode: 'invalidRecipient' } });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'failed');
  assert.equal(res.errorCode, 'invalidRecipient');
  assert.equal(res.costAgorot, 0);
  assert.equal(res.emailFallback, true);
  assert.equal(h.updates.length, 0);
  assert.equal(h.logs[0].status, 'FAILED');
  assert.equal(h.logs[0].estimatedCostAgorot, 0);
});

test('דילוג תובלה (קונפיג חסר) נרשם SKIPPED ללא עלות', async () => {
  const h = build({
    templateResult: { ok: false, skipped: true, errorCode: 'CHANNEL_NOT_CONFIGURED' },
  });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'skipped');
  assert.equal(res.errorCode, 'CHANNEL_NOT_CONFIGURED');
  assert.equal(res.costAgorot, 0);
  assert.equal(h.updates.length, 0);
  assert.equal(h.logs[0].status, 'SKIPPED');
});

test('שליחה מוצלחת מתחת לסף צוברת עלות ורושמת SENT', async () => {
  const h = build();
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'sent');
  assert.equal(res.costAgorot, 12);
  assert.equal(res.providerMessageId, 'prov-1');
  assert.equal(res.emailFallback, false);
  assert.equal(h.updates[0].monthlyWhatsappCostAgorot, 12);
  assert.equal(h.updates[0].whatsappCostMonth, MONTH);
  assert.equal(h.logs[0].status, 'SENT');
  assert.equal(h.logs[0].estimatedCostAgorot, 12);
  assert.equal(h.alerts.warn, 0);
});

test('חציית סף האזהרה שולחת מייל פעם אחת בלבד באותו חודש', async () => {
  // מתחילים ב-12 אגורות; שליחה ראשונה מגיעה ל-24 (סף האזהרה).
  const h = build({ row: makeRow({ monthlyWhatsappCostAgorot: 12, whatsappCostMonth: MONTH }) });
  const first = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(first.status, 'sent');
  assert.equal(first.crossedWarn, true);
  assert.equal(h.alerts.warn, 1);
  assert.equal(h.alerts.owner.length, 1);
  assert.equal(h.alerts.owner[0].blocked, false);

  // שליחה שנייה באותו חודש: הצובר ממשיך לעלות אך האזהרה לא נשלחת שוב.
  const second = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(second.status, 'sent');
  assert.equal(second.crossedWarn, false);
  assert.equal(h.alerts.warn, 1);
});

test('הגעה לסף החסימה שולחת מייל חסימה וחוסמת שליחות הבאות', async () => {
  // מתחילים ב-24 אגורות עם משמר אזהרה מסומן; שליחה מגיעה ל-36 (סף החסימה).
  const h = build({
    row: makeRow({
      monthlyWhatsappCostAgorot: 24,
      whatsappCostMonth: MONTH,
      whatsappWarn40SentForMonth: MONTH,
    }),
  });
  const blockingSend = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(blockingSend.status, 'sent');
  assert.equal(blockingSend.reachedBlock, true);
  assert.equal(h.alerts.block, 1);

  // שליחה נוספת נחסמת טרם קריאת ספק, נרשמת BLOCKED, ללא עלות.
  const callsBefore = h.templateCalls.length;
  const blocked = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.emailFallback, true);
  assert.equal(blocked.costAgorot, 0);
  assert.equal(h.templateCalls.length, callsBefore, 'אין קריאת ספק כשחסום');
  const lastLog = h.logs[h.logs.length - 1];
  assert.equal(lastLog.status, 'BLOCKED');
  assert.equal(lastLog.estimatedCostAgorot, 0);
});

test('אישור חריגה לחודש מאפשר שליחה גם כשהדגל חסום', async () => {
  const h = build({
    row: makeRow({
      monthlyWhatsappCostAgorot: 40,
      whatsappCostMonth: MONTH,
      whatsappBlocked: true,
      whatsappOverrideApprovedForMonth: MONTH,
    }),
  });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  // החריגה מבטלת את החסימה => השליחה מתבצעת ומחייבת.
  assert.equal(res.status, 'sent');
  assert.equal(res.costAgorot, 12);
});

test('מעבר חודש מאפס את הצובר ואת החסימה', async () => {
  const h = build({
    row: makeRow({
      monthlyWhatsappCostAgorot: 9999,
      whatsappCostMonth: '2020-01',
      whatsappBlocked: true,
    }),
  });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'sent');
  assert.equal(res.costAgorot, 12);
  assert.equal(h.updates[0].monthlyWhatsappCostAgorot, 12);
  assert.equal(h.updates[0].whatsappCostMonth, MONTH);
  assert.equal(h.updates[0].whatsappBlocked, false);
});

test('סוג הדורש תבנית ללא תבנית מוגדרת מדולג ללא עלות', async () => {
  const h = build({ config: makeConfig({ templates: { otp: undefined, confirm: undefined, reminder: undefined } }) });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'REMINDER',
  });
  assert.equal(res.status, 'skipped');
  assert.equal(res.errorCode, 'NO_TEMPLATE_CONFIGURED');
  assert.equal(res.costAgorot, 0);
  assert.equal(h.templateCalls.length, 0);
  assert.equal(h.logs[0].status, 'SKIPPED');
});

test('שגיאת DB בלתי צפויה אינה זורקת ומחזירה כשל פנימי', async () => {
  const h = build({ findUniqueThrows: true });
  const res = await deliverWhatsApp(h.deps, {
    businessId: 'biz-1',
    toPhone: VALID_PHONE,
    type: 'CONFIRMATION',
  });
  assert.equal(res.status, 'failed');
  assert.equal(res.errorCode, 'CHANNEL_INTERNAL');
  assert.equal(res.emailFallback, true);
});

test('sendOtp משתמש בתבנית ה-OTP ומעביר את הקוד כפרמטר גוף', async () => {
  const h = build();
  const res = await sendOtp({ businessId: 'biz-1', toPhone: VALID_PHONE, code: '123456' }, h.deps);
  assert.equal(res.status, 'sent');
  assert.equal(h.templateCalls[0].templateName, 'otp_tpl');
  assert.deepEqual(h.templateCalls[0].bodyParams, ['123456']);
});

test('sendCampaign ללא תבנית נופל לטקסט חופשי', async () => {
  const h = build();
  const res = await sendCampaign(
    { businessId: 'biz-1', toPhone: VALID_PHONE, text: 'מבצע לחג' },
    h.deps,
  );
  assert.equal(res.status, 'sent');
  assert.equal(h.textCalls.length, 1);
  assert.equal(h.textCalls[0].text, 'מבצע לחג');
  // תעריף שיווקי.
  assert.equal(res.costAgorot, 12);
});
