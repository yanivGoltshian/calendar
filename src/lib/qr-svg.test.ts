import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bookingQrSvg } from '@/lib/qr-svg';

const URL = 'https://torchick.duckdns.org/b/demo-salon';

test('bookingQrSvg מחזיר מחרוזת SVG תקינה עם נתיב מודולים', () => {
  const svg = bookingQrSvg(URL);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('viewBox="0 0 '));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('<path d="M'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
});

test('bookingQrSvg משבץ תווית נגישוּת מוברחת', () => {
  const svg = bookingQrSvg(URL, { label: 'קוד "QR" <לעסק>' });
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="קוד &quot;QR&quot; &lt;לעסק&gt;"'));
});

test('bookingQrSvg משתקף בשינוי הנתונים', () => {
  const a = bookingQrSvg('https://torchick.duckdns.org/b/one');
  const b = bookingQrSvg('https://torchick.duckdns.org/b/two');
  assert.notEqual(a, b);
});

test('bookingQrSvg מכבד צבעים מותאמים', () => {
  const svg = bookingQrSvg(URL, { dark: '#123456', light: '#fefefe' });
  assert.ok(svg.includes('fill="#123456"'));
  assert.ok(svg.includes('fill="#fefefe"'));
});
