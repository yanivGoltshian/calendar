import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingPath,
  bookingUrl,
  businessSharePath,
  businessShareUrl,
  isBusinessLive,
  withBusinessShareVersion,
} from '@/lib/booking-link';
import { absoluteUrl, SITE_URL } from '@/lib/seo';

test('bookingPath מחזיר נתיב יחסי של עמוד ההזמנות', () => {
  assert.equal(bookingPath('demo-salon'), '/b/demo-salon');
});

test('bookingUrl בונה כתובת מוחלטת דרך עוזר הבסיס המשותף', () => {
  const url = bookingUrl('demo-salon');
  assert.equal(url, absoluteUrl('/b/demo-salon'));
  assert.ok(url.startsWith(SITE_URL));
  assert.ok(url.endsWith('/b/demo-salon'));
  assert.ok(url.includes('://'));
});

test('bookingUrl אינו מקודד את ה-slug מחדש', () => {
  assert.equal(bookingUrl('a-b-c'), `${SITE_URL}/b/a-b-c`);
});

test('business share URLs use a deterministic logo-only cache key', () => {
  const logo = 'https://media.example/logo.webp';
  const first = businessSharePath('demo-salon', logo);
  assert.match(first, /^\/b\/demo-salon\?share=logo-only-v1-[a-z0-9]+$/);
  assert.equal(businessSharePath('demo-salon', logo), first);
  assert.notEqual(
    businessSharePath('demo-salon', 'https://media.example/other.webp'),
    first,
  );
  assert.equal(businessShareUrl('demo-salon', logo), absoluteUrl(first));
  assert.equal(
    businessSharePath('demo-salon', logo, 'booking'),
    `/b/demo-salon/book?${first.split('?')[1]}`,
  );
});

test('businesses without a logo use a deterministic text-only share key', () => {
  assert.equal(
    businessSharePath('plain-business', null),
    '/b/plain-business?share=logo-only-v1-text',
  );
  assert.equal(
    businessSharePath('plain-business', '', 'booking'),
    '/b/plain-business/book?share=logo-only-v1-text',
  );
});

test('share versioning preserves booking selections and URL fragments', () => {
  const versioned = withBusinessShareVersion(
    '/b/salon/book?service=service-1&staffId=staff-1&date=2026-09-14#time',
    'https://media.example/logo.webp',
  );
  assert.match(
    versioned,
    /^\/b\/salon\/book\?service=service-1&staffId=staff-1&date=2026-09-14&share=logo-only-v1-[a-z0-9]+#time$/,
  );
  assert.equal(
    withBusinessShareVersion(versioned, 'https://media.example/logo.webp'),
    versioned,
  );
});

test('isBusinessLive דורש גם שירות וגם שעות פעילות', () => {
  assert.equal(isBusinessLive({ serviceCount: 1, workingHoursCount: 1 }), true);
  assert.equal(isBusinessLive({ serviceCount: 3, workingHoursCount: 5 }), true);
  assert.equal(isBusinessLive({ serviceCount: 0, workingHoursCount: 1 }), false);
  assert.equal(isBusinessLive({ serviceCount: 1, workingHoursCount: 0 }), false);
  assert.equal(isBusinessLive({ serviceCount: 0, workingHoursCount: 0 }), false);
});
