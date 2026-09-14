import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicSiteLink from './PublicSiteLink';

(globalThis as unknown as { React: typeof React }).React = React;

test('superadmin public-site actions use the deterministic logo cache key', () => {
  const html = renderToStaticMarkup(
    React.createElement(PublicSiteLink, {
      slug: 'salon',
      logoUrl: 'https://media.example/logo.webp',
    }),
  );
  assert.match(html, /href="\/b\/salon\?share=logo-only-v1-[a-z0-9]+"/);
});
