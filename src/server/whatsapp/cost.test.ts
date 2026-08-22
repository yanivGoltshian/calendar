import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applySuccessfulSend,
  classifyStatus,
  currentMonth,
  effectiveMonthlyCost,
  formatShekelFromAgorot,
  isBlockedForMonth,
  type BusinessCostState,
} from '@/server/whatsapp/cost';

function state(over: Partial<BusinessCostState> = {}): BusinessCostState {
  return {
    monthlyWhatsappCostAgorot: 0,
    whatsappCostMonth: null,
    whatsappBlocked: false,
    whatsappWarn40SentForMonth: null,
    whatsappOverrideApprovedForMonth: null,
    ...over,
  };
}

test('currentMonth מחזיר YYYY-MM', () => {
  assert.match(currentMonth(new Date('2026-08-15T10:00:00Z')), /^\d{4}-\d{2}$/);
  assert.equal(currentMonth(new Date('2026-08-15T10:00:00Z')), '2026-08');
});

test('effectiveMonthlyCost מתאפס כשחודש הצבירה שונה', () => {
  const s = state({ monthlyWhatsappCostAgorot: 5000, whatsappCostMonth: '2026-07' });
  assert.equal(effectiveMonthlyCost(s, '2026-07'), 5000);
  assert.equal(effectiveMonthlyCost(s, '2026-08'), 0);
});

test('isBlockedForMonth: דגל חסימה חוסם באותו חודש', () => {
  const s = state({ whatsappBlocked: true, whatsappCostMonth: '2026-08' });
  assert.equal(isBlockedForMonth(s, '2026-08', 4500), true);
});

test('isBlockedForMonth: צובר מעל הסף חוסם גם ללא דגל', () => {
  const s = state({ monthlyWhatsappCostAgorot: 4600, whatsappCostMonth: '2026-08' });
  assert.equal(isBlockedForMonth(s, '2026-08', 4500), true);
});

test('isBlockedForMonth: אישור חריגה לאותו חודש מבטל חסימה', () => {
  const s = state({
    whatsappBlocked: true,
    monthlyWhatsappCostAgorot: 4600,
    whatsappCostMonth: '2026-08',
    whatsappOverrideApprovedForMonth: '2026-08',
  });
  assert.equal(isBlockedForMonth(s, '2026-08', 4500), false);
});

test('isBlockedForMonth: מעבר חודש מבטל חסימה', () => {
  const s = state({
    whatsappBlocked: true,
    monthlyWhatsappCostAgorot: 4600,
    whatsappCostMonth: '2026-07',
  });
  assert.equal(isBlockedForMonth(s, '2026-08', 4500), false);
});

test('classifyStatus ממפה צובר לתגית', () => {
  assert.equal(classifyStatus(0, 4000, 4500), 'ok');
  assert.equal(classifyStatus(3999, 4000, 4500), 'ok');
  assert.equal(classifyStatus(4000, 4000, 4500), 'warn');
  assert.equal(classifyStatus(4499, 4000, 4500), 'warn');
  assert.equal(classifyStatus(4500, 4000, 4500), 'blocked');
});

test('formatShekelFromAgorot ממיר אגורות לשקלים', () => {
  assert.equal(formatShekelFromAgorot(0), '0.00');
  assert.equal(formatShekelFromAgorot(12), '0.12');
  assert.equal(formatShekelFromAgorot(4000), '40.00');
  assert.equal(formatShekelFromAgorot(4512), '45.12');
});

test('applySuccessfulSend מוסיף תעריף באותו חודש', () => {
  const s = state({ monthlyWhatsappCostAgorot: 100, whatsappCostMonth: '2026-08' });
  const out = applySuccessfulSend(s, '2026-08', 12, 4000, 4500);
  assert.equal(out.newTotalAgorot, 112);
  assert.equal(out.update.monthlyWhatsappCostAgorot, 112);
  assert.equal(out.update.whatsappCostMonth, '2026-08');
  assert.equal(out.crossedWarn, false);
  assert.equal(out.reachedBlock, false);
});

test('applySuccessfulSend מגלגל ומאפס במעבר חודש', () => {
  const s = state({
    monthlyWhatsappCostAgorot: 9000,
    whatsappCostMonth: '2026-07',
    whatsappBlocked: true,
  });
  const out = applySuccessfulSend(s, '2026-08', 12, 4000, 4500);
  // הצובר מתאפס לחודש החדש ואז מוסיף תעריף.
  assert.equal(out.newTotalAgorot, 12);
  assert.equal(out.update.monthlyWhatsappCostAgorot, 12);
  assert.equal(out.update.whatsappCostMonth, '2026-08');
  // מעבר חודש מנקה את דגל החסימה.
  assert.equal(out.update.whatsappBlocked, false);
});

test('applySuccessfulSend מסמן חציית אזהרה פעם אחת בלבד', () => {
  // חציה ראשונה: הצובר מגיע לסף האזהרה.
  const first = applySuccessfulSend(
    state({ monthlyWhatsappCostAgorot: 3988, whatsappCostMonth: '2026-08' }),
    '2026-08',
    12,
    4000,
    4500,
  );
  assert.equal(first.crossedWarn, true);
  assert.equal(first.update.whatsappWarn40SentForMonth, '2026-08');

  // חציה שנייה באותו חודש כשהמשמר כבר נקבע: לא חוצה שוב.
  const second = applySuccessfulSend(
    state({
      monthlyWhatsappCostAgorot: 4000,
      whatsappCostMonth: '2026-08',
      whatsappWarn40SentForMonth: '2026-08',
    }),
    '2026-08',
    12,
    4000,
    4500,
  );
  assert.equal(second.crossedWarn, false);
});

test('applySuccessfulSend מסמן הגעה לסף חסימה', () => {
  const out = applySuccessfulSend(
    state({
      monthlyWhatsappCostAgorot: 4492,
      whatsappCostMonth: '2026-08',
      whatsappWarn40SentForMonth: '2026-08',
    }),
    '2026-08',
    12,
    4000,
    4500,
  );
  assert.equal(out.reachedBlock, true);
  assert.equal(out.update.whatsappBlocked, true);
});
