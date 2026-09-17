import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { t } from '@/i18n';
import { LANDING_SECTION_ORDER, normalizeStoredLandingContent } from '@/lib/publicPageStyle';
import LandingLocation from './LandingLocation';
import LandingSections from './LandingSections';

Object.assign(globalThis, { React });

const phone = '+97230000000';
const whatsapp = '+972500000000';
const props: React.ComponentProps<typeof LandingLocation> = {
  title: 'Synthetic location',
  address: 'Synthetic address',
  phone,
  workingHours: [{ weekday: 0, startMinute: 600, endMinute: 1140 }],
  weekdays: t.publicPage.weekdays,
  closedLabel: t.publicPage.hoursClosed,
  directionsCta: t.publicPage.landing.directionsCta,
  whatsapp,
  ...t.premiumLanding.clinic.location,
};

function render(overrides: Partial<typeof props> = {}) {
  return load(renderToStaticMarkup(React.createElement(LandingLocation, { ...props, ...overrides })));
}

test('premium business phone is labeled and repeated as a secondary action beside independent WhatsApp', () => {
  const $ = render();
  const calls = $('a[href^="tel:"]');
  assert.equal(calls.length, 2);
  assert.ok(calls.toArray().every((link) => $(link).attr('href') === `tel:${phone}`));
  assert.ok(calls.first().text().includes(props.phoneLabel!));
  assert.equal(calls.first().find('[dir="ltr"]').text(), '03-000-0000');
  assert.equal(calls.first().attr('aria-label'), `${props.phoneLabel}: 03-000-0000`);
  assert.equal(calls.last().text(), props.callCta);
  assert.equal(calls.last().prev().attr('href'), 'https://wa.me/972500000000');
  const actions = calls.last().parent();
  assert.equal(actions.find('a').length, 4);
  assert.equal(actions.find('a').eq(0).text(), props.mapsCta);
  assert.equal(actions.find('a').eq(1).text(), props.wazeCta);
  assert.ok(actions.hasClass('grid-cols-2'));
  assert.ok(actions.hasClass('sm:flex'));
  assert.ok(actions.find('a').toArray().every((link) => $(link).hasClass('min-h-12')));
  assert.ok(calls.first().hasClass('min-h-11'));
});

test('absent and blank business phones remove both call controls without borrowing the WhatsApp number', () => {
  for (const value of [null, undefined, '', ' \n ']) {
    const $ = render({ phone: value });
    assert.equal($('a[href^="tel:"]').length, 0);
    assert.ok(!$.text().includes(props.phoneLabel!));
    const chat = $('a[href="https://wa.me/972500000000"]');
    assert.equal(chat.length, 1);
    assert.ok(chat.hasClass('col-span-2'));
    assert.equal(chat.parent().find('a').length, 3);
    assert.equal($('iframe').length, 1);
    assert.equal($('[data-hours-day="0"]').length, 1);
  }
});

test('business landline is trimmed and remains callable without WhatsApp configuration', () => {
  const $ = render({ phone: ` ${phone} `, whatsapp: '  ' });
  assert.equal($('a[href^="tel:"]').length, 2);
  assert.equal($('a[href^="tel:"]').last().attr('href'), `tel:${phone}`);
  assert.ok($('a[href^="tel:"]').last().hasClass('col-span-2'));
  assert.equal($('a[href*="wa.me"]').length, 0);
});

test('existing map source, email, website and working hours remain available', () => {
  const $ = render({
    sourceMapUrl: 'https://maps.google.com/?q=synthetic',
    email: 'hello@example.test',
    websiteUrl: 'https://example.test/',
  });
  assert.equal($('a[href="https://maps.google.com/?q=synthetic"]').length, 1);
  assert.equal($('a[href^="https://waze.com"]').length, 1);
  assert.equal($('a[href="mailto:hello@example.test"]').length, 1);
  assert.equal($('a[href="https://example.test/"]').length, 1);
  assert.match($('[data-hours-day="0"]').text(), /10:00–19:00/);
  assert.equal($('iframe').attr('loading'), 'lazy');
});

test('contact addition preserves the original map wrapper for every phone configuration', () => {
  for (const overrides of [{}, { phone: null }, { whatsapp: null }]) {
    const $ = render(overrides);
    const frame = $('iframe').parent();
    assert.equal(frame.attr('class'), 'relative overflow-hidden rounded-[22px] border border-white/15 shadow-elevated');
    assert.equal(frame.attr('style'), 'aspect-ratio:4 / 3');
    assert.equal(frame.parent().attr('class'), 'order-1 lg:order-2');
  }
});

test('standard and address-free fallback layouts keep a single existing call control', () => {
  for (const overrides of [{ mapsCta: undefined, wazeCta: undefined }, { address: null }]) {
    const $ = render(overrides);
    assert.equal($('a[href^="tel:"]').length, 1);
    assert.equal($('a[href^="tel:"]').attr('href'), `tel:${phone}`);
    assert.equal($('iframe').length, 0);
  }
  const html = renderToStaticMarkup(React.createElement(LandingLocation, {
    ...props, address: null, phone: ' ', workingHours: [], whatsapp: null,
  }));
  assert.equal(html, '');
});

test('public section adapter carries the business phone and localized quick call independently of social contact', () => {
  const content = normalizeStoredLandingContent({
    sections: Object.fromEntries(LANDING_SECTION_ORDER.map((key) => [key, key === 'location'])),
    socialLinks: { whatsapp },
  });
  const $ = load(renderToStaticMarkup(React.createElement(LandingSections, {
    content, type: 'OTHER', premium: true, services: [], staff: [], businessName: 'Synthetic',
    slug: 'synthetic', workingHours: [], address: 'Synthetic address', phone,
    bookHref: '/b/synthetic/book', iconKey: 'calendar',
  })));
  const calls = $('#lp-location a[href^="tel:"]');
  assert.equal(calls.length, 2);
  assert.equal(calls.last().text(), t.premiumLanding.clinic.location.callCta);
  assert.ok(calls.first().text().includes(t.premiumLanding.clinic.location.phoneLabel));
  assert.equal(calls.last().prev().attr('href'), 'https://wa.me/972500000000');
});
