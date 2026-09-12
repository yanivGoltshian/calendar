import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapBusinessImportDraft } from './mapDraft';
import type { BusinessImportDraft } from './types';

function draft(): BusinessImportDraft {
  return {
    sourceType: 'generic-site',
    sourceUrl: 'https://example.com/',
    fetchedUrls: ['https://example.com/'],
    business: {
      name: 'Imported clinic',
      description: 'Public description',
      industry: 'Beauty',
      category: 'Clinic',
      typeSuggestion: 'CLINIC',
      websiteUrl: 'https://example.com/',
    },
    contacts: { phones: ['0501234567'], emails: ['hello@example.com'] },
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
        dayOfWeek: ['Monday', 'Tuesday'],
        opens: '09:00',
        closes: '17:30',
        raw: 'Mo-Tu 09:00-17:30',
        sourceUrl: 'https://example.com/',
      },
    ],
    services: [
      {
        name: 'Facial',
        description: 'Treatment',
        price: 250,
        currency: 'ILS',
        durationMinutes: 45,
        imageUrl: 'https://example.com/service.jpg',
        sourceUrl: 'https://example.com/services',
        evidence: [],
      },
      {
        name: 'Consultation',
        description: null,
        price: 20,
        currency: 'USD',
        durationMinutes: null,
        imageUrl: null,
        sourceUrl: 'https://example.com/services',
        evidence: [],
      },
    ],
    media: {
      logoUrl: 'https://example.com/logo.png',
      coverImageUrl: 'https://example.com/cover.jpg',
      galleryImageUrls: [
        'https://example.com/gallery.jpg',
        'https://example.com/service.jpg',
      ],
      videoUrls: ['https://example.com/video.mp4'],
    },
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com/imported' },
      { platform: 'facebook', url: 'https://facebook.com/imported' },
    ],
    evidence: [],
    warnings: [],
  };
}

test('maps imported fields without inventing public values', () => {
  const mapped = mapBusinessImportDraft(draft(), { name: null, type: null });
  assert.equal(mapped.name, 'Imported clinic');
  assert.equal(mapped.type, 'CLINIC');
  assert.equal(mapped.phone, '0501234567');
  assert.equal(mapped.address, 'Herzl 10, Tel Aviv');
  assert.equal(mapped.instagramUrl, 'https://instagram.com/imported');
  assert.deepEqual(mapped.hours, [
    { weekday: 1, startMinute: 540, endMinute: 1050, breaks: [] },
    { weekday: 2, startMinute: 540, endMinute: 1050, breaks: [] },
  ]);
  assert.deepEqual(
    mapped.services.map(
      ({ name, durationMin, priceAgorot, hideDuration, hidePrice }) => ({
        name,
        durationMin,
        priceAgorot,
        hideDuration,
        hidePrice,
      }),
    ),
    [
      {
        name: 'Facial',
        durationMin: 45,
        priceAgorot: 25000,
        hideDuration: false,
        hidePrice: false,
      },
      {
        name: 'Consultation',
        durationMin: 30,
        priceAgorot: 0,
        hideDuration: true,
        hidePrice: true,
      },
    ],
  );
  assert.equal(
    mapped.media.galleryImageUrls.filter((url) => url.endsWith('/service.jpg')).length,
    1,
  );
  assert.deepEqual(mapped.warnings.map(({ code }) => code).sort(), [
    'default-duration',
    'unsupported-currency',
  ]);
});

test('manual name and type override imported suggestions', () => {
  const mapped = mapBusinessImportDraft(draft(), {
    name: 'Reviewed name',
    type: 'BARBERSHOP',
  });
  assert.equal(mapped.name, 'Reviewed name');
  assert.equal(mapped.type, 'BARBERSHOP');
});

test('missing imported and manual name is rejected before business creation', () => {
  const missing = draft();
  missing.business.name = null;
  assert.throws(
    () => mapBusinessImportDraft(missing, { name: null, type: null }),
    /BUSINESS_IMPORT_NAME_REQUIRED/,
  );
});
