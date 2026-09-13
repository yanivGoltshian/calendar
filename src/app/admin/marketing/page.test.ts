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

test('תצוגת המכסה מציגה ספירת הודעות בלבד', () => {
  const html = renderToStaticMarkup(
    React.createElement(CostGuardPanel, {
      status: {
        countable: true,
        usedMessages: 120,
        remainingMessages: 330,
        allowanceMessages: 450,
        alertAtMessages: 400,
        usagePercent: 27,
        atAlert: false,
        blocked: false,
      },
    }),
  );
  assert.match(html, /120.*מתוך.*450.*הודעות/);
  assert.match(html, /נותרו.*330.*הודעות/);
  assert.match(html, /סף התראה.*400.*הודעות/);
  assert.doesNotMatch(html, /₪|ש&quot;ח|אגור|עלות/);
});

test('תצוגת המכסה מציגה מצב לא ניתן לחישוב בלי להמציא מכסת הודעות', () => {
  const html = renderToStaticMarkup(
    React.createElement(CostGuardPanel, {
      status: {
        countable: false,
        usedMessages: null,
        remainingMessages: null,
        allowanceMessages: null,
        alertAtMessages: null,
        usagePercent: null,
        atAlert: false,
        blocked: false,
      },
    }),
  );
  assert.match(html, /לא ניתן לחשב כרגע מכסה במספר הודעות/);
  assert.doesNotMatch(html, /4500|45\.00|₪|ש&quot;ח|אגור|עלות/);
});
