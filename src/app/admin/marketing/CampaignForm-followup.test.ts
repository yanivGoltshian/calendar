import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { CLIENT_SEGMENTS } from '@/lib/clientEngagement';
import { t } from '@/i18n';
import type { CampaignSegment } from '@/server/repos/marketing';
import CampaignForm from './CampaignForm';

(globalThis as unknown as { React: typeof React }).React = React;
const counts = Object.fromEntries(
  CLIENT_SEGMENTS.map((segment) => [segment, 0]),
) as Record<CampaignSegment, number>;

test('nonexclusive campaign SMS is visible and locked without a submitted form value', () => {
  const $ = load(
    renderToStaticMarkup(React.createElement(CampaignForm, { counts, isExclusive: false })),
  );
  const locked = $('input[type="checkbox"]:disabled');
  assert.equal(locked.length, 1);
  assert.equal(locked.closest('label').text().trim(), t.admin.marketingModule.channels.sms);
  assert.equal(locked.attr('name'), undefined);
  assert.equal(locked.attr('checked'), undefined);
  assert.deepEqual(
    $('input[name="channels"]').map((_, node) => $(node).attr('value')).get(),
    ['email'],
  );

  const dialog = $('[role="dialog"][popover]').filter(
    (_, node) => $(node).attr('aria-label') === t.admin.marketingModule.channels.sms,
  );
  assert.equal(dialog.length, 1);
  assert.ok(dialog.text().includes(t.admin.marketingModule.smsUpgradeInfo));
  assert.equal(dialog.find('a').attr('href'), '/admin/upgrade');
  assert.equal(dialog.find('a').text(), t.admin.marketingModule.smsUpgradeCta);
  const trigger = $('button[popovertarget]').filter(
    (_, node) => $(node).attr('popovertarget') === dialog.attr('id'),
  );
  assert.equal(trigger.length, 1);
  assert.equal(trigger.attr('type'), 'button');
  assert.equal(trigger.attr('disabled'), undefined);
});

test('exclusive campaigns retain selectable email and SMS while WhatsApp stays unavailable', () => {
  const $ = load(
    renderToStaticMarkup(React.createElement(CampaignForm, { counts, isExclusive: true })),
  );
  assert.deepEqual(
    $('input[name="channels"]').map((_, node) => $(node).attr('value')).get(),
    ['email', 'sms'],
  );
  assert.equal($('input[type="checkbox"]:disabled').length, 0);
  assert.equal($('input[name="channels"]:checked').length, 2);
});
