import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { t } from '@/i18n';
import UpgradeQuoteView from './UpgradeQuoteView';

(globalThis as unknown as { React: typeof React }).React = React;

test('authorized upgrade view visibly renders every plan card and its contact action', () => {
  const $ = load(
    renderToStaticMarkup(
      React.createElement(UpgradeQuoteView, {
        variant: 'page',
        stateLine: t.quote.page.active,
        contactForm: React.createElement(
          'form',
          { 'data-upgrade-contact-form': true },
          React.createElement('button', { type: 'submit' }, t.quote.form.submit),
        ),
      }),
    ),
  );

  assert.deepEqual(
    $('h3')
      .map((_, node) => $(node).text().trim())
      .get(),
    [
      t.quote.plans.standard.name,
      t.quote.plans.premium.name,
      t.quote.plans.exclusive.name,
    ],
  );
  assert.equal($('[data-upgrade-contact-form]').length, 1);
  assert.equal($('button[type="submit"]').text().trim(), t.quote.form.submit);
});

test('upgrade content connects the existing quote request form to the visible view', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'UpgradeQuoteContent.tsx'),
    'utf8',
  );
  assert.ok(source.includes('<QuoteRequestForm defaults={defaults} />'));
  assert.ok(source.includes('<UpgradeQuoteView'));
});
