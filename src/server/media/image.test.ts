import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { IMAGE_WIDTHS, MAX_RENDERED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from '@/lib/media';
import { cachedImage } from './cache';
import { optimizeImage, optimizeUploadImage } from './image';
import { createUploadHandler } from './uploadHandler';

let fixture: Promise<Buffer> | undefined;
function legacyJpeg() {
  return fixture ??= sharp({
    create: { width: 4284, height: 5712, channels: 3, background: '#4b667e' },
  }).jpeg().toBuffer();
}

async function assertWebp(image: Buffer, width: number, height: number) {
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.ok(image.length <= MAX_RENDERED_IMAGE_BYTES);
}

test('synthetic 4284x5712 JPEG renders at every public width with bounded WebP output', async () => {
  const input = await legacyJpeg();
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.width! * metadata.height!, 24_470_208);
  assert.ok(input.length <= MAX_SOURCE_IMAGE_BYTES);
  for (const width of IMAGE_WIDTHS) {
    const output = await optimizeImage(input, width);
    const expectedWidth = Math.min(width, 960);
    await assertWebp(output, expectedWidth, Math.round(expectedWidth * 4 / 3));
  }
  await assertWebp(await optimizeImage(input), 960, 1280);
});

test('legacy JPEG rendering supports progressive data and preserves EXIF display orientation', async () => {
  const input = await sharp(await legacyJpeg())
    .withMetadata({ orientation: 6 }).jpeg({ progressive: true }).toBuffer();
  assert.equal((await sharp(input).metadata()).isProgressive, true);
  await assertWebp(await optimizeImage(input), 1280, 960);
});

test('legacy JPEG pixel ceiling is inclusive and rejects larger sources', async () => {
  for (const height of [5000, 5001]) {
    const input = await sharp({
      create: { width: 6400, height, channels: 3, background: '#4b667e' },
    }).jpeg().toBuffer();
    assert.ok(input.length <= MAX_SOURCE_IMAGE_BYTES);
    if (height === 5000) {
      await assertWebp(await optimizeImage(input), 1280, 1000);
    } else {
      await assert.rejects(optimizeImage(input), /pixel limit/i);
    }
  }
});

test('PNG and WebP retain the 20MP limit for public rendering', async () => {
  for (const format of ['png', 'webp'] as const) {
    const input = await sharp({
      create: { width: 5000, height: 4001, channels: 3, background: '#4b667e' },
    }).toFormat(format).toBuffer();
    assert.ok(input.length <= MAX_SOURCE_IMAGE_BYTES);
    await assert.rejects(optimizeImage(input), /image_pixels/);
  }
});

test('uploads keep the 20MP boundary and reject legacy JPEGs before storage', async () => {
  const boundary = await sharp({
    create: { width: 5000, height: 4000, channels: 3, background: '#4b667e' },
  }).jpeg().toBuffer();
  await assertWebp(await optimizeUploadImage(boundary), 1600, 1280);
  await assertWebp(await optimizeImage(boundary), 1600, 1280);
  const input = await legacyJpeg();
  await assert.rejects(optimizeUploadImage(input), /pixel limit/i);
  let stores = 0;
  const handler = createUploadHandler({
    email: async () => 'owner@example.invalid',
    business: async () => ({
      id: 'legacy-image-upload-fixture', accountStatus: 'ACTIVE', plan: 'premium',
      subscriptionStatus: 'active', trialEndsAt: null, paidUntil: new Date(Date.now() + 86_400_000),
    }),
    configured: () => true,
    store: async () => { stores++; return 'https://storage.example.invalid/image.webp'; },
  });
  const form = new FormData();
  form.set('file', new File([new Uint8Array(input)], 'synthetic.jpg', { type: 'image/jpeg' }));
  const response = await handler(new Request('https://app.example.invalid/upload', { method: 'POST', body: form }));
  assert.equal(response.status, 415);
  assert.equal(stores, 0);
});

test('legacy rendering preserves source byte, width, and format restrictions', async () => {
  await assert.rejects(optimizeImage(Buffer.alloc(0)), /image_size/);
  await assert.rejects(optimizeImage(Buffer.alloc(MAX_SOURCE_IMAGE_BYTES + 1)), /image_size/);
  const input = await legacyJpeg();
  for (const width of [0, -1, 0.5, NaN, Infinity]) {
    await assert.rejects(optimizeImage(input, width), /image_width/);
  }
  await assert.rejects(optimizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="4001"/>')), /image_format/);
});

test('legacy output budget failure is bounded to four attempts and frees the slot', async (t) => {
  const input = await legacyJpeg();
  const oversized = Buffer.alloc(MAX_RENDERED_IMAGE_BYTES + 1);
  const encoder = t.mock.method(sharp.prototype, 'toBuffer', (async () => oversized) as typeof sharp.prototype.toBuffer);
  await assert.rejects(optimizeImage(input), /image_output_budget/);
  assert.equal(encoder.mock.callCount(), 4);
  encoder.mock.restore();
  await assertWebp(await optimizeImage(input), 960, 1280);
});

test('cached gallery bursts serialize actual legacy decoding and coalesce identical keys', async (t) => {
  const input = await legacyJpeg();
  const toBuffer = sharp.prototype.toBuffer as () => Promise<Buffer>;
  let active = 0;
  let peak = 0;
  let decodes = 0;
  t.mock.method(sharp.prototype, 'toBuffer', (async function (this: Sharp) {
    decodes++;
    peak = Math.max(peak, ++active);
    try {
      await nextTurn();
      return await toBuffer.call(this);
    } finally {
      active--;
    }
  }) as typeof sharp.prototype.toBuffer);
  const prefix = randomBytes(8).toString('hex');
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => {
    const key = `${prefix}:${Math.floor(index / 2)}`;
    return cachedImage(key, () => optimizeImage(input));
  }));
  assert.equal(peak, 1);
  assert.equal(decodes, 4);
  assert.equal(results.length, 8);
  for (const output of results) await assertWebp(output, 960, 1280);
});

test('legacy admission bounds uncached jobs and releases slots after decode failure', { timeout: 5000 }, async (t) => {
  const input = await legacyJpeg();
  const metadata = sharp.prototype.metadata as () => Promise<Metadata>;
  const toBuffer = sharp.prototype.toBuffer as () => Promise<Buffer>;
  let metadataCalls = 0;
  let active = 0;
  let peak = 0;
  let calls = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  t.mock.method(sharp.prototype, 'metadata', (async function (this: Sharp) {
    const value = await metadata.call(this);
    metadataCalls++;
    return value;
  }) as typeof sharp.prototype.metadata);
  t.mock.method(sharp.prototype, 'toBuffer', (async function (this: Sharp) {
    const current = ++calls;
    peak = Math.max(peak, ++active);
    try {
      await hold;
      if (current === 1) throw new Error('synthetic_decode_failure');
      return await toBuffer.call(this);
    } finally {
      active--;
    }
  }) as typeof sharp.prototype.toBuffer);
  const resultsPromise = Promise.allSettled(Array.from({ length: 5 }, () => optimizeImage(input)));
  try {
    while (metadataCalls < 5) await nextTurn();
    await nextTurn();
    assert.equal(calls, 1);
    assert.equal(peak, 1);
  } finally {
    release();
  }
  const results = await resultsPromise;
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 3);
  const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason.message] : []);
  assert.deepEqual(failures.sort(), ['image_busy', 'synthetic_decode_failure']);
  assert.equal(peak, 1);
  await assertWebp(await optimizeImage(input), 960, 1280);
});

test('expired legacy waiters never decode or retain the admission slot', { timeout: 5000 }, async (t) => {
  const input = await legacyJpeg();
  const metadata = sharp.prototype.metadata as () => Promise<Metadata>;
  const toBuffer = sharp.prototype.toBuffer as () => Promise<Buffer>;
  let metadataCalls = 0;
  let decodes = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(sharp.prototype, 'metadata', (async function (this: Sharp) {
    const value = await metadata.call(this);
    metadataCalls++;
    return value;
  }) as typeof sharp.prototype.metadata);
  t.mock.method(sharp.prototype, 'toBuffer', (async function (this: Sharp) {
    decodes++;
    await hold;
    return toBuffer.call(this);
  }) as typeof sharp.prototype.toBuffer);
  const resultsPromise = Promise.allSettled(Array.from({ length: 3 }, () => optimizeImage(input)));
  try {
    while (metadataCalls < 3) await nextTurn();
    await nextTurn();
    t.mock.timers.tick(12_000);
    await nextTurn();
    assert.equal(decodes, 1);
  } finally {
    release();
  }
  const results = await resultsPromise;
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason.message] : []);
  assert.deepEqual(failures, ['image_busy', 'image_busy']);
  await assertWebp(await optimizeImage(input), 960, 1280);
  assert.equal(decodes, 2);
});
