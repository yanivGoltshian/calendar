import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import React from 'react';
import { ImageResponse } from 'next/og';
import sharp, { type PngOptions, type Sharp } from 'sharp';
import { MAX_RENDERED_IMAGE_BYTES } from '@/lib/media';
import { optimizeImage } from '@/server/media/image';
import { loadImage, loadLogo } from './assets';

function pngBytes(data: string | null): Buffer {
  assert.ok(data);
  assert.match(data, /^data:image\/png;base64,/);
  const image = Buffer.from(data.split(',')[1], 'base64');
  assert.ok(image.length <= MAX_RENDERED_IMAGE_BYTES);
  return image;
}

test('owned images loaded through OG helpers render through actual ImageResponse bodies', async () => {
  const directory = `public/images/og-helper-${randomUUID()}`;
  await mkdir(directory, { recursive: true });
  try {
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#ee2222' },
    }).webp().toBuffer();
    await writeFile(`${directory}/synthetic.webp`, input, { flag: 'wx' });
    const source = `/${directory.slice('public/'.length)}/synthetic.webp`;
    for (const load of [loadLogo, loadImage]) {
      const data = await load(source);
      assert.ok(data);
      const response = new ImageResponse(
        React.createElement('img', { src: data, width: 128, height: 96 }),
        { width: 128, height: 96 },
      );
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.ok(body.length <= MAX_RENDERED_IMAGE_BYTES);
      const rendered = await sharp(body).metadata();
      assert.equal(rendered.format, 'png');
      assert.equal(rendered.width, 128);
      assert.equal(rendered.height, 96);
      const { data: pixels, info } = await sharp(body).raw().toBuffer({ resolveWithObject: true });
      const center = (48 * info.width + 64) * info.channels;
      assert.ok(pixels[center] > 200 && pixels[center + 1] < 60 && pixels[center + 2] < 60);
      const image = pngBytes(data);
      const metadata = await sharp(image).metadata();
      const bound = load === loadLogo ? 512 : 1600;
      assert.ok(metadata.width! <= bound && metadata.height! <= bound);
      assert.ok(image.length <= MAX_RENDERED_IMAGE_BYTES);
    }
    assert.equal((await sharp(await optimizeImage(input)).metadata()).format, 'webp');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('OG PNG helpers preserve transparency and support synthetic 24.47MP legacy JPEGs', async () => {
  const transparent = await sharp({
    create: { width: 64, height: 32, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.5 } },
  }).png().toBuffer();
  const logo = pngBytes(await loadLogo(`data:image/png;base64,${transparent.toString('base64')}`));
  const { data: pixels, info } = await sharp(logo).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64);
  assert.equal(info.height, 32);
  assert.equal(info.channels, 4);
  assert.ok(pixels[3] >= 127 && pixels[3] <= 128);
  const jpeg = await sharp({
    create: { width: 4284, height: 5712, channels: 3, background: '#4b667e' },
  }).jpeg().toBuffer();
  const cover = pngBytes(await loadImage(`data:image/jpeg;base64,${jpeg.toString('base64')}`));
  const metadata = await sharp(cover).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 960);
  assert.equal(metadata.height, 1280);
});

test('PNG expansion reduces dimensions to preserve the 250KiB output budget', async () => {
  const input = await sharp(randomBytes(1024 * 1024 * 3), {
    raw: { width: 1024, height: 1024, channels: 3 },
  }).png().toBuffer();
  const sanitized = await optimizeImage(input);
  const before = await sharp(sanitized).metadata();
  const converted = pngBytes(await loadImage(`data:image/png;base64,${input.toString('base64')}`));
  const after = await sharp(converted).metadata();
  assert.equal(after.format, 'png');
  assert.ok(after.width! < before.width!);
  assert.ok(after.height! < before.height!);
});

test('OG helpers fail closed on disallowed sources and oversized decoded images', async () => {
  for (const source of [null, '', '/api/book', '/images/../../package.json', 'http://127.0.0.1/private',
    'data:image/svg+xml,<svg width="1" height="1"/>', 'data:image/png;base64,aW52YWxpZA==']) {
    assert.equal(await loadLogo(source), null);
  }
  const oversized = await sharp({
    create: { width: 6400, height: 5001, channels: 3, background: 'red' },
  }).jpeg().toBuffer();
  assert.equal(await loadImage(`data:image/jpeg;base64,${oversized.toString('base64')}`), null);
});

test('PNG budget failure returns null after bounded attempts and permits a subsequent retry', async (t) => {
  const input = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#2266ee' },
  }).png().toBuffer();
  const pngPipelines = new WeakSet<Sharp>();
  const png = sharp.prototype.png;
  const toBuffer = sharp.prototype.toBuffer as () => Promise<Buffer>;
  const encode = t.mock.method(sharp.prototype, 'png', function (this: Sharp, options?: PngOptions) {
    pngPipelines.add(this);
    return png.call(this, options);
  });
  const buffer = t.mock.method(sharp.prototype, 'toBuffer', (async function (this: Sharp) {
    return pngPipelines.has(this) ? Buffer.alloc(MAX_RENDERED_IMAGE_BYTES + 1) : toBuffer.call(this);
  }) as typeof sharp.prototype.toBuffer);
  const source = `data:image/png;base64,${input.toString('base64')}`;
  assert.equal(await loadImage(source), null);
  assert.equal(encode.mock.callCount(), 4);
  buffer.mock.restore();
  encode.mock.restore();
  pngBytes(await loadImage(source));
});

test('OG PNG normalization shares the two-job render concurrency limit', { timeout: 5000 }, async (t) => {
  const sources: string[] = [];
  for (let index = 0; index < 6; index++) {
    const input = await sharp({
      create: { width: 128, height: 128, channels: 3, background: { r: index * 40, g: 55, b: 77 } },
    }).png().toBuffer();
    sources.push(`data:image/png;base64,${input.toString('base64')}`);
  }
  const pngPipelines = new WeakSet<Sharp>();
  const png = sharp.prototype.png;
  const toBuffer = sharp.prototype.toBuffer as () => Promise<Buffer>;
  let sanitized = 0;
  let active = 0;
  let peak = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  t.mock.method(sharp.prototype, 'png', function (this: Sharp, options?: PngOptions) {
    pngPipelines.add(this);
    return png.call(this, options);
  });
  t.mock.method(sharp.prototype, 'toBuffer', (async function (this: Sharp) {
    if (!pngPipelines.has(this)) {
      const output = await toBuffer.call(this);
      sanitized++;
      return output;
    }
    peak = Math.max(peak, ++active);
    try {
      await hold;
      return await toBuffer.call(this);
    } finally {
      active--;
    }
  }) as typeof sharp.prototype.toBuffer);
  const pending = Promise.all(sources.map(loadImage));
  try {
    while (sanitized < sources.length) await nextTurn();
    await nextTurn();
    assert.equal(peak, 2);
  } finally {
    release();
  }
  for (const output of await pending) pngBytes(output);
  assert.equal(peak, 2);
});
