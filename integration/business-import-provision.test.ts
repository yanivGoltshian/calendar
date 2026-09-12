import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
import { prisma } from '../src/lib/db';
import { computeTrialHashes } from '../src/server/repos/trialLedger';
import type { BusinessImportDraft } from '../src/server/businessImport';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    );
  },
});
const { provisionBusinessForAdmin } =
  require('../src/server/businessImport/provision') as typeof import('../src/server/businessImport/provision');

after(() => prisma.$disconnect());

function importedDraft(): BusinessImportDraft {
  return {
    sourceType: 'generic-site',
    sourceUrl: 'https://example.com/imported-business',
    fetchedUrls: ['https://example.com/imported-business'],
    business: {
      name: 'Imported integration business',
      description: 'Imported profile',
      industry: 'Beauty',
      category: 'Clinic',
      typeSuggestion: 'CLINIC',
      websiteUrl: 'https://example.com/imported-business',
    },
    contacts: { phones: ['0501234567'], emails: ['public@example.com'] },
    location: {
      formattedAddress: 'Herzl 10, Tel Aviv',
      streetAddress: 'Herzl 10',
      locality: 'Tel Aviv',
      region: null,
      postalCode: null,
      country: 'IL',
    },
    hours: [
      {
        dayOfWeek: ['Sunday'],
        opens: '09:00',
        closes: '17:00',
        raw: 'Sunday 09:00-17:00',
        sourceUrl: 'https://example.com/imported-business',
      },
    ],
    services: [
      {
        name: 'Imported treatment',
        description: 'Imported service',
        price: 180,
        currency: 'ILS',
        durationMinutes: 50,
        imageUrl: null,
        sourceUrl: 'https://example.com/imported-business',
        evidence: [],
      },
    ],
    media: {
      logoUrl: 'https://example.com/logo.jpg',
      coverImageUrl: null,
      galleryImageUrls: [],
      videoUrls: [],
    },
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com/imported-business' },
    ],
    evidence: [],
    warnings: [
      {
        code: 'platform-metadata-only',
        message: 'Partial public metadata was imported.',
      },
    ],
  };
}

test('superadmin import creates one draft business and retries idempotently', async () => {
  const email = `business-import-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let mediaCalls = 0;
  const request = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };
  const dependencies = {
    importer: async () => importedDraft(),
    importMedia: async () => {
      mediaCalls += 1;
      return {
        logoUrl: null,
        coverImageUrl: null,
        galleryImageUrls: [],
        warnings: [
          {
            code: 'media-storage-unavailable' as const,
            message: 'Storage disabled in integration test.',
          },
        ],
      };
    },
  };

  try {
    const first = await provisionBusinessForAdmin(request, adminEmail, dependencies);
    const second = await provisionBusinessForAdmin(request, adminEmail, dependencies);
    assert.equal(second.business.id, first.business.id);
    assert.equal(mediaCalls, 1);
    assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 1);

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: first.business.id },
      include: {
        services: { include: { staffLinks: true } },
        workingHours: { where: { scope: 'BUSINESS' } },
      },
    });
    assert.equal(business.name, 'Imported integration business');
    assert.equal(business.type, 'CLINIC');
    assert.equal(business.description, 'Imported profile');
    assert.equal(business.phone, '0501234567');
    assert.equal(business.listed, false);
    assert.equal(business.services.length, 1);
    assert.equal(business.services[0]?.name, 'Imported treatment');
    assert.equal(business.services[0]?.staffLinks.length, 1);
    assert.equal(business.workingHours.length, 1);
    assert.ok(business.businessImportedAt);
    assert.equal(
      business.businessImportSourceUrl,
      'https://example.com/imported-business',
    );
    assert.ok(
      first.importReview?.warnings.some(({ code }) => code === 'platform-metadata-only'),
    );
    assert.ok(
      first.importReview?.warnings.some(
        ({ code }) => code === 'media-storage-unavailable',
      ),
    );
  } finally {
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});
