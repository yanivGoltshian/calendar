import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  badgeLabel,
  shapeDashboardRows,
  shapeRow,
  summarize,
  type WhatsAppBusinessInput,
} from './logic';

const MONTH = '2026-08';
const THRESHOLDS = { warnAgorot: 4000, blockAgorot: 4500 };

function biz(over: Partial<WhatsAppBusinessInput> = {}): WhatsAppBusinessInput {
  return {
    id: 'b1',
    name: 'עסק',
    ownerEmail: 'o@x.com',
    plan: 'exclusive',
    monthlyWhatsappCostAgorot: 0,
    whatsappCostMonth: MONTH,
    whatsappBlocked: false,
    whatsappWarn40SentForMonth: null,
    whatsappOverrideApprovedForMonth: null,
    ...over,
  };
}

test('badgeLabel מציג תוויות עברית לפי הספים', () => {
  assert.equal(badgeLabel('ok', THRESHOLDS), 'תקין');
  assert.equal(badgeLabel('warn', THRESHOLDS), '⚠️ מעל 40');
  assert.equal(badgeLabel('blocked', THRESHOLDS), '⛔ חסום מעל 45');
});

test('shapeRow: מתחת לסף האזהרה — תקין', () => {
  const row = shapeRow(biz({ monthlyWhatsappCostAgorot: 1200 }), MONTH, 100, THRESHOLDS);
  assert.equal(row.status, 'ok');
  assert.equal(row.costShekel, '12.00');
  assert.equal(row.monthCount, 100);
  assert.equal(row.blocked, false);
});

test('shapeRow: מעל סף האזהרה ומתחת לחסימה — אזהרה', () => {
  const row = shapeRow(biz({ monthlyWhatsappCostAgorot: 4200 }), MONTH, 10, THRESHOLDS);
  assert.equal(row.status, 'warn');
  assert.equal(row.badge, '⚠️ מעל 40');
});

test('shapeRow: דגל חסימה — חסום', () => {
  const row = shapeRow(
    biz({ monthlyWhatsappCostAgorot: 4600, whatsappBlocked: true }),
    MONTH,
    10,
    THRESHOLDS,
  );
  assert.equal(row.status, 'blocked');
  assert.equal(row.blocked, true);
  assert.equal(row.badge, '⛔ חסום מעל 45');
});

test('shapeRow: אישור חריגה מוריד מ-blocked ל-warn אך מסמן overrideApproved', () => {
  const row = shapeRow(
    biz({
      monthlyWhatsappCostAgorot: 4600,
      whatsappBlocked: true,
      whatsappOverrideApprovedForMonth: MONTH,
    }),
    MONTH,
    10,
    THRESHOLDS,
  );
  assert.equal(row.blocked, false);
  assert.equal(row.status, 'warn');
  assert.equal(row.overrideApproved, true);
});

test('shapeRow: חודש שהתגלגל מתאפס ל-0 ותקין', () => {
  const row = shapeRow(
    biz({ monthlyWhatsappCostAgorot: 9999, whatsappCostMonth: '2020-01', whatsappBlocked: true }),
    MONTH,
    0,
    THRESHOLDS,
  );
  assert.equal(row.costAgorot, 0);
  assert.equal(row.status, 'ok');
  assert.equal(row.blocked, false);
});

test('shapeDashboardRows ממיין חסומים, אזהרות, ואז לפי עלות יורדת', () => {
  const rows = shapeDashboardRows(
    [
      biz({ id: 'ok1', name: 'א', monthlyWhatsappCostAgorot: 500 }),
      biz({ id: 'warn1', name: 'ב', monthlyWhatsappCostAgorot: 4100 }),
      biz({ id: 'blocked1', name: 'ג', monthlyWhatsappCostAgorot: 4600, whatsappBlocked: true }),
      biz({ id: 'warn2', name: 'ד', monthlyWhatsappCostAgorot: 4300 }),
    ],
    MONTH,
    new Map(),
    THRESHOLDS,
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['blocked1', 'warn2', 'warn1', 'ok1'],
  );
});

test('summarize סופר מצבים וסכום כולל', () => {
  const rows = shapeDashboardRows(
    [
      biz({ id: 'a', monthlyWhatsappCostAgorot: 500 }),
      biz({ id: 'b', monthlyWhatsappCostAgorot: 4100 }),
      biz({ id: 'c', monthlyWhatsappCostAgorot: 4600, whatsappBlocked: true }),
    ],
    MONTH,
    new Map([['a', 5], ['b', 40], ['c', 46]]),
    THRESHOLDS,
  );
  const sum = summarize(rows);
  assert.equal(sum.total, 3);
  assert.equal(sum.blocked, 1);
  assert.equal(sum.warn, 1);
  assert.equal(sum.ok, 1);
  // 500 + 4100 + 4600 = 9200 אגורות => 92.00 ₪
  assert.equal(sum.totalCostShekel, '92.00');
});
