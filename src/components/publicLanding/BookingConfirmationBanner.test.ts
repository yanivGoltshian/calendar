import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BookingConfirmationBanner from './BookingConfirmationBanner';

(globalThis as unknown as { React: typeof React }).React = React;

test('guest redirect shows only an escaped generic heading, without appointment actions or links', () => {
  const html = renderToStaticMarkup(React.createElement(BookingConfirmationBanner, {
    heading: 'התור נקבע <script>alert(1)</script>',
  }));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('התור נקבע'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/<(?:a|form|input|button|script)\b/.test(html));
});

test('an empty generic heading does not render a banner', () => {
  assert.equal(renderToStaticMarkup(React.createElement(BookingConfirmationBanner, { heading: '  ' })), '');
});
