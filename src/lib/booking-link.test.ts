import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bookingPath, bookingUrl, isBusinessLive } from '@/lib/booking-link';
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

test('isBusinessLive דורש גם שירות וגם שעות פעילות', () => {
  assert.equal(isBusinessLive({ serviceCount: 1, workingHoursCount: 1 }), true);
  assert.equal(isBusinessLive({ serviceCount: 3, workingHoursCount: 5 }), true);
  assert.equal(isBusinessLive({ serviceCount: 0, workingHoursCount: 1 }), false);
  assert.equal(isBusinessLive({ serviceCount: 1, workingHoursCount: 0 }), false);
  assert.equal(isBusinessLive({ serviceCount: 0, workingHoursCount: 0 }), false);
});
