import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runBusinessImportCli } from '../../../scripts/import-business';
import {
  BusinessImportError,
  createPinnedLookup,
  detectBusinessImportSource,
  fetchPublicImage,
  importBusinessFromUrl,
  isPublicNetworkAddress,
  type BusinessImportFetch,
} from './index';

const fixtureDirectory = new URL('./__fixtures__/', import.meta.url);
const publicResolver = async () => [{ address: '8.8.8.8', family: 4 }];

async function fixture(name: string): Promise<string> {
  return readFile(new URL(name, fixtureDirectory), 'utf8');
}

type FixtureResponse = {
  body?: string;
  status?: number;
  headers?: Record<string, string>;
  delayMs?: number;
};

function fixtureFetch(
  responses: Record<string, FixtureResponse>,
  activity?: { calls: string[]; active: number; peak: number },
): BusinessImportFetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    activity?.calls.push(url);
    if (activity) {
      activity.active += 1;
      activity.peak = Math.max(activity.peak, activity.active);
    }
    const response = responses[url] ?? { status: 404, body: 'not found' };
    try {
      if (response.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, response.delayMs);
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
      }
      return new Response(response.body ?? '', {
        status: response.status ?? 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          ...response.headers,
        },
      });
    } finally {
      if (activity) activity.active -= 1;
    }
  };
}

test('מזהה את ארבעת סוגי המקור', () => {
  assert.equal(detectBusinessImportSource('https://app.calmark.co.il/noa'), 'calmark');
  assert.equal(detectBusinessImportSource('https://instagram.com/noa'), 'instagram');
  assert.equal(detectBusinessImportSource('https://m.facebook.com/noa'), 'facebook');
  assert.equal(detectBusinessImportSource('https://example.com'), 'generic-site');
});

test('אתר רגיל מחזיר טיוטה מלאה ממידע מובנה ומעמודים פנימיים מוגבלים', async () => {
  const [home, services, about, contact, gallery] = await Promise.all([
    fixture('generic-home.html'),
    fixture('generic-services.html'),
    fixture('generic-about.html'),
    fixture('generic-contact.html'),
    fixture('generic-gallery.html'),
  ]);
  const activity = { calls: [] as string[], active: 0, peak: 0 };
  const fetch = fixtureFetch(
    {
      'https://example.com/': { body: home },
      'https://example.com/services': { body: services, delayMs: 5 },
      'https://example.com/about': { body: about, delayMs: 5 },
      'https://example.com/contact': { body: contact, delayMs: 5 },
      'https://example.com/gallery': { body: gallery, delayMs: 5 },
      'https://example.com/pricing': { body: '<html><body>pricing</body></html>' },
    },
    activity,
  );

  const draft = await importBusinessFromUrl('https://example.com', fetch, {
    resolveHostname: publicResolver,
  });

  assert.equal(draft.sourceType, 'generic-site');
  assert.equal(draft.business.name, 'קליניקת אור');
  assert.equal(draft.business.typeSuggestion, 'CLINIC');
  assert.equal(draft.business.websiteUrl, 'https://example.com/');
  assert.deepEqual(draft.contacts.phones, ['+972501234567']);
  assert.deepEqual(draft.contacts.emails, ['hello@example.com']);
  assert.equal(draft.location.formattedAddress, 'הרצל 10, תל אביב, תל אביב, 61000, IL');
  assert.equal(draft.hours.length, 2);
  assert.equal(draft.services.length, 2);
  assert.deepEqual(
    draft.services.map(({ name, price, currency, durationMinutes }) => ({
      name,
      price,
      currency,
      durationMinutes,
    })),
    [
      { name: 'טיפול פנים', price: 250, currency: 'ILS', durationMinutes: 45 },
      { name: 'אבחון עור', price: 120.5, currency: 'ILS', durationMinutes: null },
    ],
  );
  assert.ok(
    draft.media.galleryImageUrls.includes('https://example.com/images/team-large.jpg'),
  );
  assert.ok(!draft.media.galleryImageUrls.some((url) => url.includes('pixel.gif')));
  assert.deepEqual(draft.media.videoUrls.sort(), [
    'https://example.com/videos/embedded.webm',
    'https://example.com/videos/tour.mp4',
    'https://youtube.com/watch?v=fixture',
  ]);
  assert.ok(!draft.media.videoUrls.some((url) => url.endsWith('manifest.webm')));
  assert.deepEqual(draft.socialLinks.map(({ platform }) => platform).sort(), [
    'facebook',
    'instagram',
    'youtube',
  ]);
  assert.ok(draft.evidence.some((item) => item.field === 'business.name'));
  assert.ok(
    draft.evidence.some((item) => item.field.includes('services.טיפול פנים.price')),
  );
  assert.ok(activity.calls.length <= 6);
  assert.ok(!activity.calls.some((url) => url.startsWith('https://evil.example')));
  assert.ok(!activity.calls.some((url) => /\/(?:images|videos)\//.test(url)));
  assert.ok(activity.peak <= 2);
});

test('קאלמרק מחלץ שירות, מחיר, משך ושעות', async () => {
  const html = await fixture('calmark.html');
  const draft = await importBusinessFromUrl(
    'https://app.calmark.co.il/noa',
    fixtureFetch({ 'https://app.calmark.co.il/noa': { body: html } }),
    { resolveHostname: publicResolver },
  );
  assert.equal(draft.sourceType, 'calmark');
  assert.equal(draft.business.name, 'נועה סטודיו');
  assert.equal(draft.business.typeSuggestion, 'NAILS');
  assert.equal(draft.services[0]?.price, 150);
  assert.equal(draft.services[0]?.durationMinutes, 60);
  assert.equal(draft.hours[0]?.opens, '08:30');
  assert.equal(draft.hours[0]?.closes, '17:00');
});

test('אינסטגרם ופייסבוק מסתפקים במטא דאטה ציבורי ומצהירים על המגבלה', async () => {
  const [instagram, facebook] = await Promise.all([
    fixture('instagram.html'),
    fixture('facebook.html'),
  ]);
  const instagramDraft = await importBusinessFromUrl(
    'https://www.instagram.com/dana_beauty/',
    fixtureFetch({ 'https://www.instagram.com/dana_beauty/': { body: instagram } }),
    { resolveHostname: publicResolver },
  );
  assert.equal(instagramDraft.business.name, 'Dana Beauty');
  assert.deepEqual(instagramDraft.contacts.phones, ['0501112233']);
  assert.ok(
    instagramDraft.warnings.some(({ code }) => code === 'platform-metadata-only'),
  );

  const facebookDraft = await importBusinessFromUrl(
    'https://www.facebook.com/danahair',
    fixtureFetch({ 'https://www.facebook.com/danahair': { body: facebook } }),
    { resolveHostname: publicResolver },
  );
  assert.equal(facebookDraft.business.name, 'Dana Hair');
  assert.deepEqual(facebookDraft.contacts.emails, ['contact@danahair.example']);
  assert.ok(facebookDraft.warnings.some(({ code }) => code === 'platform-metadata-only'));
});

test('חסימת פלטפורמה מחזירה טיוטה חלקית עם אזהרה מפורשת', async () => {
  const draft = await importBusinessFromUrl(
    'https://instagram.com/blocked',
    fixtureFetch({ 'https://instagram.com/blocked': { status: 429 } }),
    { resolveHostname: publicResolver },
  );
  assert.equal(draft.sourceType, 'instagram');
  assert.equal(draft.business.name, null);
  assert.ok(draft.warnings.some(({ code }) => code === 'platform-blocked'));
  assert.ok(draft.warnings.some(({ code }) => code === 'missing-name'));
});

test('חוסם localhost, כתובות פרטיות, metadata וכתובות DNS מעורבות לפני fetch', async () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '168.63.129.16',
    '192.168.1.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ]) {
    assert.equal(isPublicNetworkAddress(address), false, address);
  }
  assert.equal(isPublicNetworkAddress('8.8.8.8'), true);
  assert.equal(isPublicNetworkAddress('2606:4700:4700::1111'), true);

  let fetched = false;
  const fetch: BusinessImportFetch = async () => {
    fetched = true;
    return new Response('', { headers: { 'content-type': 'text/html' } });
  };
  await assert.rejects(
    importBusinessFromUrl('http://localhost/business', fetch),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'blocked_hostname',
  );
  await assert.rejects(
    importBusinessFromUrl('https://public.example/business', fetch, {
      resolveHostname: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    }),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'blocked_address',
  );
  assert.equal(fetched, false);
});

test('חיפוש מוצמד מחזיר את כל כתובות IPv4 ו-IPv6 המאומתות בפורמט שמצופה בחיבור', async () => {
  const addresses = [
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '8.8.8.8', family: 4 },
  ];
  const lookup = createPinnedLookup(addresses);
  const all = await new Promise<Array<{ address: string; family: number }>>(
    (resolve, reject) => {
      lookup('public.example', { all: true }, (error, result) => {
        if (error) reject(error);
        else if (Array.isArray(result)) resolve(result);
        else reject(new Error('Expected an address array.'));
      });
    },
  );
  assert.deepEqual(all, addresses);

  const ipv4 = await new Promise<{ address: string; family: number }>(
    (resolve, reject) => {
      lookup('public.example', { all: false, family: 4 }, (error, address, family) => {
        if (error) reject(error);
        else if (typeof address === 'string') resolve({ address, family: family ?? 0 });
        else reject(new Error('Expected one address.'));
      });
    },
  );
  assert.deepEqual(ipv4, addresses[1]);
});

test('כשל חיבור כולל אבחון בטוח ללא חשיפת הכתובות שנבדקו', async () => {
  const transportError = Object.assign(new TypeError('fetch failed for 8.8.8.8'), {
    cause: Object.assign(new Error('route to 8.8.8.8 failed'), {
      code: 'ENETUNREACH',
    }),
  });
  await assert.rejects(
    importBusinessFromUrl(
      'https://public.example/',
      async () => {
        throw transportError;
      },
      {
        resolveHostname: async () => [
          { address: '2606:4700:4700::1111', family: 6 },
          { address: '8.8.8.8', family: 4 },
        ],
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof BusinessImportError);
      assert.deepEqual(error.diagnostics, {
        stage: 'connect',
        resolvedAddressCount: 2,
        resolvedAddressFamilies: [6, 4],
        transportCode: 'ENETUNREACH',
      });
      assert.ok(!JSON.stringify(error.diagnostics).includes('8.8.8.8'));
      return true;
    },
  );
});

test('בודק כל יעד הפניה מחדש וחוסם הפניה לכתובת פנימית', async () => {
  const activity = { calls: [] as string[], active: 0, peak: 0 };
  const fetch = fixtureFetch(
    {
      'https://public.example/': {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      },
    },
    activity,
  );
  await assert.rejects(
    importBusinessFromUrl('https://public.example/', fetch, {
      resolveHostname: publicResolver,
    }),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'blocked_address',
  );
  assert.deepEqual(activity.calls, ['https://public.example/']);
});

test('מגביל הפניות ודוחה סוג תוכן שאינו HTML', async () => {
  await assert.rejects(
    importBusinessFromUrl(
      'https://redirect.example/',
      fixtureFetch({
        'https://redirect.example/': {
          status: 302,
          headers: { location: '/second' },
        },
        'https://redirect.example/second': {
          status: 302,
          headers: { location: '/third' },
        },
      }),
      { resolveHostname: publicResolver, maxRedirects: 1 },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'redirect_limit',
  );

  await assert.rejects(
    importBusinessFromUrl(
      'https://document.example/file.pdf',
      fixtureFetch({
        'https://document.example/file.pdf': {
          body: '%PDF fixture',
          headers: { 'content-type': 'application/pdf' },
        },
      }),
      { resolveHostname: publicResolver },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'content_type',
  );
});

test('אוכף timeout ומגבלת גודל גם ללא הורדת מדיה', async () => {
  await assert.rejects(
    importBusinessFromUrl(
      'https://slow.example/',
      fixtureFetch({ 'https://slow.example/': { body: '<html></html>', delayMs: 50 } }),
      { resolveHostname: publicResolver, timeoutMs: 5 },
    ),
    (error: unknown) => error instanceof BusinessImportError && error.code === 'timeout',
  );

  await assert.rejects(
    importBusinessFromUrl(
      'https://large.example/',
      fixtureFetch({
        'https://large.example/': {
          body: '<html></html>',
          headers: { 'content-length': '1000' },
        },
      }),
      { resolveHostname: publicResolver, maxResponseBytes: 100 },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'response_too_large',
  );

  await assert.rejects(
    importBusinessFromUrl(
      'https://stream-large.example/',
      fixtureFetch({
        'https://stream-large.example/': {
          body: `<html>${'x'.repeat(101)}</html>`,
        },
      }),
      { resolveHostname: publicResolver, maxResponseBytes: 100 },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'response_too_large',
  );
});

test('הורדת תמונה עוברת דרך אותן הגנות SSRF, הפניות, סוג וגודל', async () => {
  const image = await fetchPublicImage(
    'https://images.example/logo.png',
    fixtureFetch({
      'https://images.example/logo.png': {
        body: 'png-bytes',
        headers: { 'content-type': 'image/png' },
      },
    }),
    { resolveHostname: publicResolver, maxResponseBytes: 100 },
  );
  assert.equal(image.contentType, 'image/png');
  assert.equal(image.bytes.toString(), 'png-bytes');

  await assert.rejects(
    fetchPublicImage('http://127.0.0.1/logo.png', fixtureFetch({}), {
      resolveHostname: publicResolver,
    }),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'blocked_address',
  );
  await assert.rejects(
    fetchPublicImage(
      'https://images.example/redirect.jpg',
      fixtureFetch({
        'https://images.example/redirect.jpg': {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data' },
        },
      }),
      { resolveHostname: publicResolver },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'blocked_address',
  );
  await assert.rejects(
    fetchPublicImage(
      'https://images.example/logo.svg',
      fixtureFetch({
        'https://images.example/logo.svg': {
          body: '<svg/>',
          headers: { 'content-type': 'image/svg+xml' },
        },
      }),
      { resolveHostname: publicResolver },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'content_type',
  );
  await assert.rejects(
    fetchPublicImage(
      'https://images.example/large.jpg',
      fixtureFetch({
        'https://images.example/large.jpg': {
          body: 'too-large',
          headers: { 'content-type': 'image/jpeg', 'content-length': '1000' },
        },
      }),
      { resolveHostname: publicResolver, maxResponseBytes: 10 },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'response_too_large',
  );
});

test('ממשק שורת הפקודה מדפיס JSON תקין ליציאה התקנית', async () => {
  const html = await fixture('calmark.html');
  let stdout = '';
  let stderr = '';
  const code = await runBusinessImportCli(['https://app.calmark.co.il/noa'], {
    importer: (url) =>
      importBusinessFromUrl(
        url,
        fixtureFetch({ 'https://app.calmark.co.il/noa': { body: html } }),
        { resolveHostname: publicResolver },
      ),
    stdout: { write: (value) => ((stdout += String(value)), true) },
    stderr: { write: (value) => ((stderr += String(value)), true) },
  });
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.equal(JSON.parse(stdout).business.name, 'נועה סטודיו');
});
