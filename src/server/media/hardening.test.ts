import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { request } from 'node:https';
import React from 'react';
import { t } from '@/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { JsonLd } from '@/components/JsonLd';
import MediaImage from '@/components/publicLanding/MediaImage';
import LandingGallery from '@/components/publicLanding/LandingGallery';
import LandingSocialCta from '@/components/publicLanding/LandingSocialCta';
import LandingBooking, { type BookingLabels } from '@/components/publicLanding/LandingBooking';
import { scriptSafeJson } from '@/lib/jsonLd';
import { localBusinessJsonLd } from '@/lib/seo';
import { MAX_RENDERED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from '@/lib/media';
import { publicMediaContent, findLegacyImage, legacyImageHash } from './publicContent';
import { optimizeImage } from './image';
import { isPublicAddress, permittedRemoteImage, readSafeImage, fetchPinnedImage, ownedPublicAssetPath } from './safeFetch';
import { assertMediaQuota, boundedFormData, mediaQuota, validVideoSignature } from './uploadPolicy';
import { cachedImage } from './cache';
import { createUploadHandler } from './uploadHandler';

// tsx runs TSX fixtures using the classic runtime, unlike the Next production compiler.
(globalThis as unknown as { React: typeof React }).React = React;

test('JSON-LD preserves all hostile fields as data inside exactly one script', () => {
  const attack = '</ScRiPt><script>alert(1)</script><!-- & > \u2028\u2029';
  const data = localBusinessJsonLd({ name: attack, slug: attack, description: attack, address: attack, phone: attack, image: attack, instagramUrl: attack });
  const html = renderToStaticMarkup(React.createElement(JsonLd, { data }));
  assert.equal((html.match(/<script\b/gi) ?? []).length, 1);
  assert.equal((html.match(/<\/script>/gi) ?? []).length, 1);
  assert.deepEqual(JSON.parse(scriptSafeJson(data)), data);
  assert.ok(!scriptSafeJson(data).includes('<'));
  assert.ok(!scriptSafeJson(data).includes('\u2028'));
});

test('real large raster legacy fixture is not repeated in compressed public SSR or serialized props', async () => {
  const jpeg = await sharp(randomBytes(1600 * 1000 * 3), { raw: { width: 1600, height: 1000, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  const data = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  const original = { slug: 'fixture', name: '<b>שם & עסק</b>', logoUrl: data, coverImageUrl: data,
    landingContent: { heroImages: [data], galleryImageUrls: [data, data], heroHeadline: 'טיפולים מותאמים אישית', about: 'תיאור העסק '.repeat(500) } };
  assert.ok(gzipSync(JSON.stringify(original)).length > 2_000_000);
  const projected = publicMediaContent(original, 'fixture');
  assert.ok(!JSON.stringify(projected).includes('data:image'));
  assert.equal(projected.logoUrl, projected.coverImageUrl);
  assert.ok(findLegacyImage(original, legacyImageHash(data))?.equals(jpeg));
  const html = renderToStaticMarkup(React.createElement('main', null,
    React.createElement('h1', null, projected.name),
    React.createElement(JsonLd, { data: localBusinessJsonLd({ ...projected, image: projected.coverImageUrl }) }),
    React.createElement(MediaImage, { src: projected.coverImageUrl, alt: projected.name, priority: true }),
    React.createElement(LandingGallery, { title: projected.name, images: projected.landingContent.galleryImageUrls }),
    React.createElement('script', { type: 'application/json', dangerouslySetInnerHTML: { __html: scriptSafeJson(projected) } })));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('fetchPriority="high"'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(!html.includes('data:image'));
  assert.ok(gzipSync(html).length < 100 * 1024);
  const optimized = await optimizeImage(jpeg);
  const metadata = await sharp(optimized).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width! <= 1600 && metadata.height! <= 1600);
  assert.ok(optimized.length <= MAX_RENDERED_IMAGE_BYTES);
  console.log(`media fixture: source JSON gzip=${gzipSync(JSON.stringify(original)).length}; SSR fixture gzip=${gzipSync(html).length}; hero=${optimized.length} bytes`);
});

test('real calendar SSR stays date-neutral until business timezone hydration', () => {
  const labels: BookingLabels = {
    title: 'booking', pill: 'choose', treatmentLabel: 'service', staffLabel: 'staff', staffAny: 'any',
    dateLabel: 'date', timeLabel: 'time', weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    months: Array.from({ length: 12 }, (_, i) => `month${i + 1}`), prevMonth: 'previous', nextMonth: 'next',
    loadingSlots: 'loading-date', noSlots: 'none', loadError: 'load-error', configurationError: 'configuration-error',
    retrySlots: 'retry', summaryEmpty: 'choose', cta: 'book', note: '',
    unavailableTitle: 'unavailable', unavailableBody: '',
  };
  const html = renderToStaticMarkup(React.createElement(LandingBooking, {
    slug: 'fixture', services: [{ id: 'service', name: 'service' }], staff: [{ id: 'staff', displayName: 'staff' }],
    bookHref: '/b/fixture/book', labels, timeZone: 'Asia/Jerusalem',
  }));
  assert.ok(html.includes('loading-date'));
  assert.ok(!html.includes('date='));
  assert.ok(!html.includes('month1 0'));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(html));
});

test('public booking retains every service and staff option and auto-selects a sole staff member', () => {
  const services = Array.from({ length: 6 }, (_, index) => ({
    id: `service${index}`, name: index === 5 ? `long-service-${'x'.repeat(160)}` : `service${index}`,
  }));
  const labels = t.premiumLanding.clinic.booking;
  for (const count of [0, 1, 4]) {
    const staff = Array.from({ length: count }, (_, index) => ({ id: `staff${index}`, displayName: `staff${index}` }));
    const html = renderToStaticMarkup(React.createElement(LandingBooking, {
      slug: 'fixture', services, staff, bookHref: '/b/fixture/book', labels,
    }));
    for (const service of services) assert.ok(html.includes(`>${service.name}</button>`));
    for (const member of staff) assert.ok(html.includes(`>${member.displayName}</button>`));
    assert.equal(html.includes(`>${labels.staffAny}</button>`), count > 1);
    if (count === 1) {
      assert.match(html, /<button\b[^>]*aria-pressed="true"[^>]*>staff0<\/button>/);
      assert.ok(html.includes('staffId=staff0'));
    }
  }
});

test('follow section requires Facebook, Instagram or TikTok and never presents WhatsApp as following', () => {
  const labels = t.publicPage.landing;
  const props = {
    ctaTitle: 'follow-section', ctaText: '', ctaLabel: 'book', bookHref: '/b/fixture/book',
    socialTitle: 'follow', labels: {
      whatsapp: labels.whatsapp, instagram: labels.instagram, facebook: labels.facebook, tiktok: labels.tiktok,
    },
  };
  for (const socialLinks of [{}, { whatsapp: '0501234567' }, { whatsapp: '0501234567', instagram: '  ' }]) {
    assert.equal(renderToStaticMarkup(React.createElement(LandingSocialCta, { ...props, socialLinks })), '');
  }
  for (const kind of ['facebook', 'instagram', 'tiktok'] as const) {
    const html = renderToStaticMarkup(React.createElement(LandingSocialCta, {
      ...props, socialLinks: { [kind]: 'synthetic', whatsapp: '0501234567' },
    }));
    assert.ok(html.includes('follow-section'));
    assert.ok(html.includes(`${kind}.com`));
    assert.ok(!html.includes('wa.me'));
  }
});

test('oversized legacy landing JSON never corrupts required business relations', () => {
  const business = {
    landingContent: { rows: Array.from({ length: 80 }, () => Array(80).fill('data:image/jpeg;base64,YQ==')) },
    services: [{ id: 'service' }],
    staff: [{ id: 'staff' }],
    workingHours: [{ weekday: 1, startMinute: 540, endMinute: 1020 }],
    coverImageUrl: 'data:image/jpeg;base64,YQ==',
  };
  const projected = publicMediaContent(business, 'bounded');
  assert.deepEqual(projected.landingContent, {});
  assert.equal(projected.services, business.services);
  assert.equal(projected.staff, business.staff);
  assert.equal(projected.workingHours, business.workingHours);
  assert.ok(!JSON.stringify(projected).includes('data:'));
});

test('oversized data, SVG and forged image MIME never become public executable content', async () => {
  assert.equal(publicMediaContent({ image: 'data:image/svg+xml,<svg onload=alert(1) />' }, 'x').image, '');
  assert.equal(publicMediaContent({ image: 'data:image/jpeg;base64,' + 'A'.repeat(12_000_000) }, 'x').image, '');
  await assert.rejects(optimizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')));
  await assert.rejects(optimizeImage(Buffer.from('<html>not an image</html>')));
});

test('image origins and private addresses fail closed before connecting', async () => {
  const allowed = ['https://owned.example'];
  for (const url of ['http://owned.example/a.jpg', 'https://owned.example.evil/a', 'https://user@owned.example/a', 'https://owned.example:444/a', 'https://owned.example/a#b', '//owned.example/a']) {
    assert.equal(permittedRemoteImage(url, allowed), null, url);
  }
  assert.equal(permittedRemoteImage('https://owned.example/a.jpg', allowed)?.origin, allowed[0]);
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '2002:7f00:1::', '2001:db8::1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  await assert.rejects(readSafeImage('/api/book'));
  await assert.rejects(readSafeImage('/brand/../../package.json'));
  await assert.rejects(readSafeImage('/brand/../icons/icon.png'));
  let contacted = false;
  await assert.rejects(fetchPinnedImage(new URL('https://owned.example/a'), {
    resolve: async () => [{ address: '127.0.0.1', family: 4 }],
    request: (() => { contacted = true; throw new Error('must not connect'); }) as unknown as typeof request,
  }));
  assert.equal(contacted, false);
});

test('first-party absolute images resolve only to exact configured origins and safe public paths', () => {
  const env = { NEXT_PUBLIC_APP_URL: 'https://app.example', AUTH_URL: 'https://canonical.example' };
  const file = '/brand/business/demo-barbershop.png';
  assert.equal(ownedPublicAssetPath(`https://app.example${file}`, env), file);
  assert.equal(ownedPublicAssetPath(`https://canonical.example${file}`, env), file);
  for (const source of [
    `http://app.example${file}`, `https://app.example.evil${file}`,
    `https://app.example:444${file}`, `https://user@app.example${file}`,
    `https://user:pass@app.example${file}`, `https://app.example${file}#fragment`,
    `https://127.0.0.1${file}`, `https://169.254.169.254${file}`,
    `https://another.azurecontainerapps.io${file}`,
  ]) assert.equal(ownedPublicAssetPath(source, env), null, source);
  for (const pathname of [
    '/api/book', '/package.json', '/brand/../../package.json',
    '/brand/../icons/icon-192.png', '/brand/%2e%2e/icons/icon-192.png',
    '/brand/%252e%252e/file.png', '/brand\\..\\icons\\icon-192.png',
    '/brand//../../package.json', `${file}?redirect=https://evil.example/image`,
  ]) assert.throws(() => ownedPublicAssetPath(`https://app.example${pathname}`, env), /image_path/, pathname);
  assert.equal(ownedPublicAssetPath(`https://app.example${file}`, {}), null);
});

test('actual bundled barber PNG and its persisted absolute form decode identically without HTTP', async () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://bundled-assets.example.invalid';
  try {
    const file = '/brand/business/demo-barbershop.png';
    const relative = await readSafeImage(file);
    const absolute = await readSafeImage(`${process.env.NEXT_PUBLIC_APP_URL}${file}`);
    assert.ok(relative.equals(absolute));
    const rendered = await optimizeImage(absolute, 320);
    const metadata = await sharp(rendered).metadata();
    assert.equal(metadata.format, 'webp');
    assert.deepEqual([metadata.width, metadata.height], [320, 320]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

function fakeRequest(statusCode: number, body: Buffer, length?: string) {
  let pinned = '';
  const transport = ((_url: URL, options: { family: number; lookup: (...args: unknown[]) => void }, callback: (res: unknown) => void) => {
    assert.equal(options.family, 4);
    options.lookup('owned.example', {}, (_error: unknown, address: string) => { pinned = address; });
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const response = Object.assign(new PassThrough(), { statusCode, headers: { 'content-type': 'image/png', 'content-length': length } });
      callback(response);
      response.end(body);
    };
    return req;
  }) as unknown as typeof request;
  return { transport, pinned: () => pinned };
}

test('checked DNS is pinned; redirects and oversized streamed bodies are rejected', async () => {
  const resolve = async () => [{ address: '8.8.8.8', family: 4 }];
  const success = fakeRequest(200, Buffer.from('png fixture'));
  assert.equal((await fetchPinnedImage(new URL('https://owned.example/image'), { resolve, request: success.transport })).toString(), 'png fixture');
  assert.equal(success.pinned(), '8.8.8.8');
  for (const status of [301, 302, 307, 308]) {
    const redirect = fakeRequest(status, Buffer.alloc(0));
    await assert.rejects(fetchPinnedImage(new URL('https://owned.example/image'), { resolve, request: redirect.transport }));
  }
  const oversized = fakeRequest(200, Buffer.alloc(MAX_SOURCE_IMAGE_BYTES + 1));
  await assert.rejects(fetchPinnedImage(new URL('https://owned.example/image'), { resolve, request: oversized.transport }));
});

test('quota counts each object and byte and rejects overflow', () => {
  const quota = mediaQuota('basic');
  assert.doesNotThrow(() => assertMediaQuota('basic', { bytes: quota.bytes - 1, objects: quota.objects - 1 }, 1));
  assert.throws(() => assertMediaQuota('basic', { bytes: quota.bytes, objects: 0 }, 1));
  assert.throws(() => assertMediaQuota('basic', { bytes: 0, objects: quota.objects }, 1));
});

test('streamed uploads are bounded even without Content-Length', async () => {
  const request = new Request('https://app.example/upload', { method: 'POST', body: 'x'.repeat(500), headers: { 'content-type': 'multipart/form-data; boundary=x' } });
  await assert.rejects(boundedFormData(request, 100), /גדול/);
  assert.equal(validVideoSignature(Buffer.from('not a video'), 'video/mp4'), false);
  assert.equal(validVideoSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm'), true);
});

test('image cache coalesces simultaneous same-asset render jobs', async () => {
  let calls = 0;
  const key = randomBytes(8).toString('hex');
  const load = async () => { calls++; return Buffer.from('result'); };
  await Promise.all([cachedImage(key, load), cachedImage(key, load), cachedImage(key, load)]);
  assert.equal(calls, 1);
});

test('image cache queues gallery bursts while bounding render concurrency', async () => {
  let active = 0;
  let peak = 0;
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => cachedImage(randomBytes(8).toString('hex'), async () => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return Buffer.from(String(i));
  })));
  assert.equal(results.length, 8);
  assert.equal(peak, 2);
});

test('actual upload handler rejects expired/deletion-pending accounts before parsing or storing', async () => {
  for (const state of ['expired', 'deleting', 'not-owned']) {
    let stores = 0;
    const handler = createUploadHandler({
      email: async () => 'owner@example.com',
      business: async () => state === 'not-owned' ? null : ({
        id: 'fixture', accountStatus: state === 'deleting' ? 'PENDING_DELETION' : 'ACTIVE',
        plan: 'basic', subscriptionStatus: 'trialing',
        trialEndsAt: new Date(state === 'expired' ? 0 : Date.now() + 86400_000), paidUntil: null,
      }),
      configured: () => true,
      store: async () => { stores++; return 'https://owned.example/image.webp'; },
    });
    const request = new Request('https://app.example/upload', { method: 'POST', body: 'not even multipart' });
    const response = await handler(request);
    assert.equal(response.status, 403);
    assert.equal(request.bodyUsed, false);
    assert.equal(stores, 0);
  }
});

test('actual upload handler decodes content, stores bounded WebP, and rejects forged image content', async () => {
  const stored: { length: number; type: string; ext: string }[] = [];
  const handler = createUploadHandler({
    email: async () => 'owner@example.com',
    business: async () => ({ id: 'fixture', accountStatus: 'ACTIVE', plan: 'premium',
      subscriptionStatus: 'active', trialEndsAt: null, paidUntil: new Date(Date.now() + 86400_000) }),
    configured: () => true,
    store: async (_id, _email, input, type, ext) => { stored.push({ length: input.length, type, ext }); return 'https://owned.example/image.webp'; },
  });
  const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'red' } }).png().toBuffer();
  for (const input of [png, Buffer.from('<script>not an image</script>')]) {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(input)], { type: 'image/png' }), 'photo.png');
    const response = await handler(new Request('https://app.example/upload', { method: 'POST', body: form }));
    assert.equal(response.status, input === png ? 200 : 415);
  }
  assert.equal(stored.length, 1);
  assert.equal(stored[0].type, 'image/webp');
  assert.equal(stored[0].ext, 'webp');
  assert.ok(stored[0].length <= MAX_RENDERED_IMAGE_BYTES);
});

test('upload concurrency rejects a second tenant upload without consuming its body and releases the slot', async () => {
  let release!: () => void;
  let started!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const storing = new Promise<void>((resolve) => { started = resolve; });
  const handler = createUploadHandler({
    email: async () => 'owner@example.com',
    business: async () => ({ id: 'concurrent-fixture', accountStatus: 'ACTIVE', plan: 'premium',
      subscriptionStatus: 'active', trialEndsAt: null, paidUntil: new Date(Date.now() + 86400_000) }),
    configured: () => true,
    store: async () => { started(); await hold; return 'https://owned.example/image.webp'; },
  });
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
  const request = () => {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'photo.png');
    return new Request('https://app.example/upload', { method: 'POST', body: form });
  };
  const first = handler(request());
  await storing;
  try {
    const second = request();
    assert.equal((await handler(second)).status, 429);
    assert.equal(second.bodyUsed, false);
  } finally { release(); }
  assert.equal((await first).status, 200);
  assert.equal((await handler(request())).status, 200);
});
