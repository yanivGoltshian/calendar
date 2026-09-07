import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { GET } from '@/app/api/public/image/route';
import { prisma } from '@/lib/db';
import { MAX_RENDERED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES, MEDIA_CACHE_CONTROL } from '@/lib/media';

test('public image endpoint preserves a synthetic 4284x5712 JPEG and rejects unsafe or oversized sources', async (t) => {
  const originalFind = prisma.business.findFirst;
  let databaseCalls = 0;
  const denyDatabase = () => {
    databaseCalls++;
    throw new Error('unexpected_database_query');
  };
  prisma.business.findFirst = denyDatabase;
  t.after(() => { prisma.business.findFirst = originalFind; });
  assert.equal(prisma.business.findFirst, denyDatabase);
  const directory = `public/brand/image-route-${randomUUID()}`;
  await mkdir(directory, { recursive: true });
  const source = `/${directory.slice('public/'.length)}/synthetic.jpg`;
  const request = (src: string, width = 1600) => new Request(
    `https://app.example.invalid/api/public/image?${new URLSearchParams({ src, w: String(width) })}`,
  );
  try {
    const input = await sharp(Buffer.from([230, 32, 32, 32, 48, 230]), {
      raw: { width: 2, height: 1, channels: 3 },
    }).resize({ width: 4284, height: 5712, fit: 'fill', kernel: 'nearest' }).jpeg().toBuffer();
    const original = await sharp(input).metadata();
    assert.equal(original.width, 4284);
    assert.equal(original.height, 5712);
    assert.ok(input.length <= MAX_SOURCE_IMAGE_BYTES);
    await writeFile(`${directory}/synthetic.jpg`, input, { flag: 'wx' });

    const response = await GET(request(source));
    assert.equal(response.status, 200);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('content-length'), String(body.length));
    assert.equal(response.headers.get('cache-control'), MEDIA_CACHE_CONTROL);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; sandbox");
    assert.equal(response.headers.get('location'), null);
    assert.ok(body.length <= MAX_RENDERED_IMAGE_BYTES);
    const metadata = await sharp(body).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 960);
    assert.equal(metadata.height, 1280);
    const { data: pixels, info } = await sharp(body).raw().toBuffer({ resolveWithObject: true });
    const left = (640 * info.width + 240) * info.channels;
    const right = (640 * info.width + 720) * info.channels;
    assert.ok(pixels[left] > 200 && pixels[left + 1] < 65 && pixels[left + 2] < 65);
    assert.ok(pixels[right] < 65 && pixels[right + 1] < 75 && pixels[right + 2] > 200);

    await rm(`${directory}/synthetic.jpg`);
    const cached = await GET(request(source));
    assert.equal(cached.status, 200);
    assert.deepEqual(Buffer.from(await cached.arrayBuffer()), body);
    assert.equal((await GET(request(source, 123))).status, 400);

    const oversized = await sharp({
      create: { width: 6400, height: 5001, channels: 3, background: 'red' },
    }).jpeg().toBuffer();
    assert.ok(oversized.length <= MAX_SOURCE_IMAGE_BYTES);
    await writeFile(`${directory}/oversized.jpg`, oversized, { flag: 'wx' });
    for (const rejected of [source.replace('synthetic.jpg', 'oversized.jpg'), '/api/book', 'http://127.0.0.1/private']) {
      const denied = await GET(request(rejected));
      assert.equal(denied.status, 404);
      assert.equal(denied.headers.get('cache-control'), 'no-store');
      assert.equal((await denied.arrayBuffer()).byteLength, 0);
    }
    assert.equal(databaseCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
