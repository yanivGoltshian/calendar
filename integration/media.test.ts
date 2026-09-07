import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/db';
import { storeBusinessMedia, type MediaStorage } from '../src/server/media/storage';
import { createUploadHandler } from '../src/server/media/uploadHandler';
import { MediaError } from '../src/server/media/uploadPolicy';
import { bookingFixture, cleanupFixture, requireIsolatedDatabase } from './fixtures';

requireIsolatedDatabase();

function syntheticStorage() {
  const objects = new Map<string, Buffer>();
  let failAfterWrite = false;
  const storage: MediaStorage = {
    getBlockBlobClient: (key) => ({
      url: `https://storage.example.invalid/${key}`,
      exists: async () => objects.has(key),
      uploadData: async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(objects.has(key), false);
        objects.set(key, data);
        if (failAfterWrite) throw new Error('synthetic_storage_outcome_unknown');
      },
    }),
    async *listBlobsFlat({ prefix }) {
      for (const [key, value] of objects) {
        if (key.startsWith(prefix)) yield { properties: { contentLength: value.length } };
      }
    },
  };
  return {
    objects,
    storage,
    failNextWrite: () => {
      failAfterWrite = true;
    },
  };
}

test('real business row locks serialize storage quotas across concurrent writers and deduplicate retries', async () => {
  const f = await bookingFixture();
  const store = syntheticStorage();
  try {
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        plan: 'basic',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 86_400_000),
      },
    });
    for (let index = 0; index < 29; index++) {
      store.objects.set(
        `media/${f.business.id}/legacy-${index}.webp`,
        Buffer.from('old'),
      );
    }
    const input = [Buffer.from('first'), Buffer.from('second')];
    const results = await Promise.allSettled(
      input.map((value) =>
        storeBusinessMedia(
          f.business.id,
          f.business.ownerEmail!,
          value,
          'image/webp',
          'webp',
          store.storage,
        ),
      ),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const failure = results.find((result) => result.status === 'rejected');
    assert.ok(
      failure?.status === 'rejected' &&
        failure.reason instanceof MediaError &&
        failure.reason.status === 413,
    );
    assert.equal(store.objects.size, 30);
    const winner = results.findIndex((result) => result.status === 'fulfilled');
    const winnerResult = results[winner];
    assert.ok(winnerResult.status === 'fulfilled');
    const replay = await storeBusinessMedia(
      f.business.id,
      f.business.ownerEmail!,
      input[winner],
      'image/webp',
      'webp',
      store.storage,
    );
    assert.equal(replay, winnerResult.value);
    assert.equal(store.objects.size, 30);
  } finally {
    await cleanupFixture(f);
  }
});

test('upload handler and storage transaction reject ownership and lifecycle changes before external writes', async () => {
  const f = await bookingFixture();
  const store = syntheticStorage();
  try {
    await assert.rejects(
      storeBusinessMedia(
        f.business.id,
        'not-owner@example.invalid',
        Buffer.from('data'),
        'image/webp',
        'webp',
        store.storage,
      ),
      (error: unknown) => error instanceof MediaError && error.status === 403,
    );
    const handler = createUploadHandler({
      email: async () => f.business.ownerEmail,
      business: async () => f.business,
      configured: () => true,
      store: async (...args) => {
        await prisma.business.update({
          where: { id: f.business.id },
          data: { accountStatus: 'PENDING_DELETION' },
        });
        return storeBusinessMedia(...args, store.storage);
      },
    });
    const form = new FormData();
    form.set(
      'file',
      new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0])], 'synthetic.webm', {
        type: 'video/webm',
      }),
    );
    const response = await handler(
      new Request('http://localhost/api/upload/media', { method: 'POST', body: form }),
    );
    assert.equal(response.status, 403);
    assert.equal(store.objects.size, 0);
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        accountStatus: 'ACTIVE',
        paidUntil: new Date(0),
        subscriptionStatus: 'expired',
        trialEndsAt: new Date(0),
      },
    });
    await assert.rejects(
      storeBusinessMedia(
        f.business.id,
        f.business.ownerEmail!,
        Buffer.from('data'),
        'image/webp',
        'webp',
        store.storage,
      ),
      (error: unknown) => error instanceof MediaError && error.status === 403,
    );
    assert.equal(store.objects.size, 0);
  } finally {
    await cleanupFixture(f);
  }
});

test('an uncertain storage outcome retains its object and quota while a retry reuses the stored content', async () => {
  const f = await bookingFixture();
  const store = syntheticStorage();
  try {
    store.failNextWrite();
    const input = Buffer.from('synthetic persisted before response failure');
    await assert.rejects(
      storeBusinessMedia(
        f.business.id,
        f.business.ownerEmail!,
        input,
        'image/webp',
        'webp',
        store.storage,
      ),
      /synthetic_storage_outcome_unknown/,
    );
    assert.equal(store.objects.size, 1);
    const retry = await storeBusinessMedia(
      f.business.id,
      f.business.ownerEmail!,
      input,
      'image/webp',
      'webp',
      store.storage,
    );
    assert.match(retry, /\/media\//);
    assert.equal(store.objects.size, 1);
  } finally {
    await cleanupFixture(f);
  }
});
