import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SensitiveWatermark } from './SensitiveWatermark';

test('sensitive watermark renders a noninteractive audit marker with responsive density', () => {
  const html = renderToStaticMarkup(
    React.createElement(SensitiveWatermark, { auditId: 'ab-12_cd34' }),
  );
  assert.match(html, /data-sensitive-watermark="AB12CD34"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /pointer-events-none/);
  assert.match(html, /grid-cols-2/);
  assert.match(html, /sm:grid-cols-3/);
  assert.equal(html.includes('@'), false);
});

test('sensitive watermark omits invalid empty identifiers', () => {
  assert.equal(
    renderToStaticMarkup(React.createElement(SensitiveWatermark, { auditId: '---' })),
    '',
  );
});

test('public page shells do not include the sensitive watermark', () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const path of [
    join(src, 'app', 'page.tsx'),
    join(src, 'app', 'b', '[slug]', 'layout.tsx'),
    join(src, 'app', 'b', '[slug]', 'page.tsx'),
  ]) {
    assert.equal(readFileSync(path, 'utf8').includes('SensitiveWatermark'), false);
  }
});
