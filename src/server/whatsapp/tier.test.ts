import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveTierChannels, tierAllowsWhatsApp } from '@/server/whatsapp/tier';

test('exclusive מקבל וואטסאפ ומייל', () => {
  assert.deepEqual(resolveTierChannels('exclusive'), { whatsapp: true, email: true });
  assert.equal(tierAllowsWhatsApp('exclusive'), true);
});

test('premium מקבל מייל בלבד', () => {
  assert.deepEqual(resolveTierChannels('premium'), { whatsapp: false, email: true });
  assert.equal(tierAllowsWhatsApp('premium'), false);
});

test('basic/standard/ריק/לא ידוע — ללא ערוצים', () => {
  for (const plan of ['basic', 'standard', '', 'unknown', 'free']) {
    assert.deepEqual(resolveTierChannels(plan), { whatsapp: false, email: false }, plan);
    assert.equal(tierAllowsWhatsApp(plan), false, plan);
  }
});

test('null/undefined לא מפילים ומחזירים ללא ערוצים', () => {
  assert.deepEqual(resolveTierChannels(null), { whatsapp: false, email: false });
  assert.deepEqual(resolveTierChannels(undefined), { whatsapp: false, email: false });
});

test('נרמול: רישיות ורווחים אינם משנים את התוצאה', () => {
  assert.equal(tierAllowsWhatsApp('  Exclusive  '), true);
  assert.equal(tierAllowsWhatsApp('EXCLUSIVE'), true);
  assert.equal(resolveTierChannels(' Premium ').email, true);
});
