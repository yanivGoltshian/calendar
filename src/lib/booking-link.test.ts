import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bookingPath, bookingUrl, isBusinessLive, rebookPath, rebookUrl } from '@/lib/booking-link';
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

test('rebookPath בונה קישור עמוק עם שירות בלבד', () => {
  assert.equal(rebookPath('demo-salon', 'svc-1'), '/b/demo-salon?rebook=svc-1');
});

test('rebookPath מוסיף את איש הצוות כאשר קיים', () => {
  assert.equal(
    rebookPath('demo-salon', 'svc-1', 'stf-9'),
    '/b/demo-salon?rebook=svc-1&staff=stf-9',
  );
});

test('rebookPath מתעלם מ-staff ריק או null', () => {
  assert.equal(rebookPath('demo-salon', 'svc-1', ''), '/b/demo-salon?rebook=svc-1');
  assert.equal(rebookPath('demo-salon', 'svc-1', null), '/b/demo-salon?rebook=svc-1');
});

test('rebookPath מקודד ערכי query בטוחים לכתובת', () => {
  assert.equal(
    rebookPath('demo-salon', 'a b', 's&t'),
    '/b/demo-salon?rebook=a%20b&staff=s%26t',
  );
});

test('rebookUrl בונה כתובת מוחלטת דרך עוזר הבסיס המשותף', () => {
  const url = rebookUrl('demo-salon', 'svc-1', 'stf-9');
  assert.equal(url, absoluteUrl('/b/demo-salon?rebook=svc-1&staff=stf-9'));
  assert.ok(url.startsWith(SITE_URL));
  assert.equal(url, `${SITE_URL}/b/demo-salon?rebook=svc-1&staff=stf-9`);
});
