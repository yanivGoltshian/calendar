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
  assert.equal(result.importReview, storedReview);
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
  assert.equal(result.importReview, storedReview);
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
