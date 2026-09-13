import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { BusinessImportError } from './network';
import { importBusinessMedia } from './media';
import type {
  BusinessImportReviewSnapshot,
  ProvisionBusinessDependencies,
} from './provision';

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

const retryRequest = {
  name: null,
  type: null,
  ownerName: null,
  ownerEmail: 'owner@example.com',
  phoneIdentity: null,
  importUrl: 'https://example.com/business',
};

const storedReview = {
  version: 1,
  draft: {},
  warnings: [],
  applied: { serviceCount: 1, hoursCount: 1, ownedMediaCount: 0 },
} as unknown as BusinessImportReviewSnapshot;

function existingImport(importedAt: Date | null, draft: unknown) {
  return {
    id: 'existing-business',
    businessImportSourceUrl: retryRequest.importUrl,
    businessImportDraft: draft,
    businessImportedAt: importedAt,
  };
}

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
        findExistingImports: async () => [],
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

test('completed same-source retry returns the stored review before import or creation', async () => {
  let importerCalls = 0;
  let createCalls = 0;
  const result = await provisionBusinessForAdmin(retryRequest, 'admin@example.com', {
    findExistingImports: (async () => [
      existingImport(new Date(), storedReview),
    ]) as unknown as NonNullable<ProvisionBusinessDependencies['findExistingImports']>,
    importer: async () => {
      importerCalls += 1;
      throw new Error('completed retry must not fetch');
    },
    create: (async () => {
      createCalls += 1;
      throw new Error('completed retry must not create');
    }) as never,
  });
  assert.equal(result.business.id, 'existing-business');
  assert.deepEqual(result.importReview, {
    ...storedReview,
    draft: {
      location: { mapUrl: null },
      staff: [],
      bookingPolicy: {
        minLeadTimeMinutes: null,
        cancellationWindowHours: null,
        maxAdvanceBookingDays: null,
        bookingRequiresApproval: null,
        notes: [],
      },
      media: { instagramPostUrls: [] },
    },
    missingFields: [],
    applied: {
      ...storedReview.applied,
      staffCount: 0,
      bookingPolicyFieldCount: 0,
      mediaAssets: [],
    },
  });
  assert.equal(importerCalls, 0);
  assert.equal(createCalls, 0);
});

test('pending same-source retry waits for the stored review before import or creation', async () => {
  let importerCalls = 0;
  let createCalls = 0;
  let stateReads = 0;
  const result = await provisionBusinessForAdmin(retryRequest, 'admin@example.com', {
    findExistingImports: (async () => [
      existingImport(null, {
        version: 1,
        status: 'importing',
        claimToken: 'claim-token',
        recordedAt: new Date().toISOString(),
      }),
    ]) as unknown as NonNullable<ProvisionBusinessDependencies['findExistingImports']>,
    getImportState: async () => {
      stateReads += 1;
      return {
        businessImportSourceUrl: retryRequest.importUrl,
        businessImportDraft: storedReview as never,
        businessImportedAt: new Date(),
      };
    },
    importer: async () => {
      importerCalls += 1;
      throw new Error('pending retry must not fetch');
    },
    create: (async () => {
      createCalls += 1;
      throw new Error('pending retry must not create');
    }) as never,
  });
  assert.equal(result.business.id, 'existing-business');
  assert.deepEqual(result.importReview, {
    ...storedReview,
    draft: {
      location: { mapUrl: null },
      staff: [],
      bookingPolicy: {
        minLeadTimeMinutes: null,
        cancellationWindowHours: null,
        maxAdvanceBookingDays: null,
        bookingRequiresApproval: null,
        notes: [],
      },
      media: { instagramPostUrls: [] },
    },
    missingFields: [],
    applied: {
      ...storedReview.applied,
      staffCount: 0,
      bookingPolicyFieldCount: 0,
      mediaAssets: [],
    },
  });
  assert.equal(stateReads, 1);
  assert.equal(importerCalls, 0);
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

test('media import deduplicates resized variants and preserves owned attribution', async () => {
  let fetches = 0;
  let stores = 0;
  const result = await importBusinessMedia(
    'business-1',
    'owner@example.com',
    {
      logoUrl: 'https://cdn.example.com/multi/logo.png',
      coverImageUrl: 'https://cdn.example.com/multi/hero.jpg',
      galleryImageUrls: [
        'https://cdn.example.com/multi/opt/logo-1920w.png',
        'https://cdn.example.com/multi/hero.jpg',
      ],
    },
    {
      storageConfigured: () => true,
      fetchImpl: async (input) => {
        fetches += 1;
        return new Response(Buffer.from(String(input)), {
          headers: { 'content-type': 'image/png' },
        });
      },
      networkOptions: {
        resolveHostname: async () => [{ address: '8.8.8.8', family: 4 }],
      },
      inspectImage: async () => ({ width: 800, height: 600, format: 'png' }),
      optimize: async (input) => input,
      store: async (_businessId, _ownerEmail, input) => {
        stores += 1;
        return `https://owned.example/${input.toString().includes('logo') ? 'logo' : 'hero'}.webp`;
      },
    },
  );
  assert.equal(fetches, 2);
  assert.equal(stores, 2);
  assert.equal(result.logoUrl, 'https://owned.example/logo.webp');
  assert.equal(result.coverImageUrl, 'https://owned.example/hero.webp');
  assert.deepEqual(result.galleryImageUrls, []);
  assert.deepEqual(
    result.assets?.map(({ sourceUrl }) => sourceUrl),
    ['https://cdn.example.com/multi/logo.png', 'https://cdn.example.com/multi/hero.jpg'],
  );
});

test('one copied image can satisfy multiple imported media roles', async () => {
  let fetches = 0;
  const result = await importBusinessMedia(
    'business-1',
    'owner@example.com',
    {
      logoUrl: 'https://cdn.example.com/multi/logo.png',
      coverImageUrl: 'https://cdn.example.com/multi/opt/logo-1920w.png',
      galleryImageUrls: [],
    },
    {
      storageConfigured: () => true,
      fetchImpl: async () => {
        fetches += 1;
        return new Response(Buffer.from('image'), {
          headers: { 'content-type': 'image/png' },
        });
      },
      networkOptions: {
        resolveHostname: async () => [{ address: '8.8.8.8', family: 4 }],
      },
      inspectImage: async () => ({ width: 800, height: 600, format: 'png' }),
      optimize: async (input) => input,
      store: async () => 'https://owned.example/logo.webp',
    },
  );
  assert.equal(fetches, 1);
  assert.equal(result.logoUrl, 'https://owned.example/logo.webp');
  assert.equal(result.coverImageUrl, 'https://owned.example/logo.webp');
  assert.equal(result.assets?.length, 1);
});

test('media import copies a direct public video after signature validation', async () => {
  const bytes = Buffer.from('0000ftypisom');
  const result = await importBusinessMedia(
    'business-1',
    'owner@example.com',
    {
      logoUrl: null,
      coverImageUrl: null,
      galleryImageUrls: [],
      videoUrls: ['https://media.example/hero.mp4'],
    },
    {
      storageConfigured: () => true,
      fetchImpl: async () =>
        new Response(bytes, { headers: { 'content-type': 'video/mp4' } }),
      networkOptions: {
        resolveHostname: async () => [{ address: '8.8.8.8', family: 4 }],
      },
      store: async (_businessId, _ownerEmail, input, type, ext) => {
        assert.deepEqual(input, bytes);
        assert.equal(type, 'video/mp4');
        assert.equal(ext, 'mp4');
        return 'https://owned.example/hero.mp4';
      },
    },
  );
  assert.equal(result.heroVideoUrl, 'https://owned.example/hero.mp4');
  assert.equal(result.assets?.[0]?.sourceUrl, 'https://media.example/hero.mp4');
});
