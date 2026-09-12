import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { t } from '@/i18n';
import CostGuardPanel from '../settings/CostGuardPanel';

const marketingDir = dirname(fileURLToPath(import.meta.url));
(globalThis as unknown as { React: typeof React }).React = React;

test('שם הפיצ׳ר וההסבר מתארים הודעות, עדכונים ומבצעים ללקוחות', () => {
  const labels = t.admin.marketingModule;
  assert.equal(labels.title, 'הודעות ללקוחות');
  assert.match(labels.subtitle, /עדכונים ומבצעים/);
  assert.doesNotMatch(JSON.stringify(labels), /דיוור/);
});

test('עמוד הודעות ללקוחות מציג תקציב מסרונים רק לאקסקלוסיב', () => {
  const page = readFileSync(join(marketingDir, 'page.tsx'), 'utf8');
  assert.match(page, /isExclusive \? getCostGuardStatus\(business\.id\)/);
  assert.match(page, /<CostGuardPanel status=\{costGuardStatus\} \/>/);
});

test('פעולת היצירה אוכפת את הרשאות הערוצים בצד השרת', () => {
  const actions = readFileSync(join(marketingDir, 'actions.ts'), 'utf8');
  assert.match(actions, /validateCampaignChannelSelection/);
  assert.match(actions, /canSendPaidClientSms\(business\)/);
});

test('תצוגת התקציב מציגה שימוש ויתרה מתוך תקרה של 45 ש״ח', () => {
  const html = renderToStaticMarkup(
    React.createElement(CostGuardPanel, {
      status: {
        usedAgorot: 1200,
        remainingAgorot: 3300,
        capAgorot: 4500,
        alertAgorot: 4000,
        atAlert: false,
        blocked: false,
      },
    }),
  );
  assert.match(html, /12.*מתוך.*45/);
  assert.match(html, /נותר עד לתקרה.*33/);
});
