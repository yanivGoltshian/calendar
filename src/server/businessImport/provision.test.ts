import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { BusinessImportError } from './network';
import { importBusinessMedia } from './media';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    );
  },
});
const { provisionBusinessForAdmin } =
  require('./provision') as typeof import('./provision');

test('import failure stops before business creation', async () => {
  let createCalls = 0;
  await assert.rejects(
    provisionBusinessForAdmin(
      {
        name: 'Fallback name',
        type: 'OTHER',
        ownerName: null,
        ownerEmail: 'owner@example.com',
        phoneIdentity: null,
        importUrl: 'https://example.com/business',
      },
      'admin@example.com',
      {
        importer: async () => {
          throw new BusinessImportError(
            'network_error',
            'The request failed.',
            'https://example.com/business',
          );
        },
        create: (async () => {
          createCalls += 1;
          throw new Error('create should not run');
        }) as never,
      },
    ),
    (error: unknown) =>
      error instanceof BusinessImportError && error.code === 'network_error',
  );
  assert.equal(createCalls, 0);
});

test('media copy failures remain explicit warnings instead of external URLs', async () => {
  const result = await importBusinessMedia(
    'business-1',
    'owner@example.com',
    {
      logoUrl: 'https://images.example/logo.jpg',
      coverImageUrl: null,
      galleryImageUrls: [],
    },
    {
      storageConfigured: () => true,
      fetchImpl: async () => {
        throw new Error('network failure');
      },
      networkOptions: {
        resolveHostname: async () => [{ address: '8.8.8.8', family: 4 }],
      },
    },
  );
  assert.equal(result.logoUrl, null);
  assert.deepEqual(result.galleryImageUrls, []);
  assert.deepEqual(
    result.warnings.map(({ code }) => code),
    ['media-fetch-failed'],
  );
});
