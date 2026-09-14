import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareBusiness from './ShareBusiness';

(globalThis as unknown as { React: typeof React }).React = React;

test('business share controls use the supplied deterministic URL for every target', () => {
  const shareUrl = 'https://example.test/b/salon?share=logo-only-v1-abc';
  const html = renderToStaticMarkup(
    React.createElement(ShareBusiness, {
      shareUrl,
      businessName: 'Salon',
    }),
  );
  assert.ok(html.includes(shareUrl));
  assert.ok(html.includes(encodeURIComponent(shareUrl)));
  assert.equal((html.match(/share=logo-only-v1-abc/g) ?? []).length >= 1, true);
});
