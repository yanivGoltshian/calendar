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
const {
  BusinessIdentityConflictError,
  BusinessImportConflictError,
  provisionBusinessForAdmin,
} =
  require('../src/server/businessImport/provision') as typeof import('../src/server/businessImport/provision');
const { claimBusinessImport } =
  require('../src/server/repos/businessImport') as typeof import('../src/server/repos/businessImport');

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

test('same-source pending and completed retries reuse one import before creation', async () => {
  const email = `business-import-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let mediaCalls = 0;
  let importerCalls = 0;
  let releaseMedia!: () => void;
  let mediaStarted!: () => void;
  const mediaRelease = new Promise<void>((resolve) => {
    releaseMedia = resolve;
  });
  const mediaClaimed = new Promise<void>((resolve) => {
    mediaStarted = resolve;
  });
  const request = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };
  const dependencies = {
    importer: async () => {
      importerCalls += 1;
      return importedDraft();
    },
    importMedia: async () => {
      mediaCalls += 1;
      mediaStarted();
      await mediaRelease;
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
    const importing = provisionBusinessForAdmin(request, adminEmail, dependencies);
    await mediaClaimed;
    const pendingRetry = provisionBusinessForAdmin(request, adminEmail, {
      ...dependencies,
      importer: async () => {
        importerCalls += 1;
        throw new Error('pending retry must not import again');
      },
    });
    releaseMedia();
    const [first, second] = await Promise.all([importing, pendingRetry]);
    const retry = await provisionBusinessForAdmin(request, adminEmail, {
      ...dependencies,
      importer: async () => {
        importerCalls += 1;
        throw new Error('completed retry must not import again');
      },
    });
    assert.equal(second.business.id, first.business.id);
    assert.equal(retry.business.id, first.business.id);
    assert.equal(mediaCalls, 1);
    assert.equal(importerCalls, 1);
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
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('a competing manual provision wins before import creation without being reused', async () => {
  const email = `business-import-manual-race-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let releaseImporter!: () => void;
  let importerStarted!: () => void;
  let mediaCalls = 0;
  const importerRelease = new Promise<void>((resolve) => {
    releaseImporter = resolve;
  });
  const importerBlocked = new Promise<void>((resolve) => {
    importerStarted = resolve;
  });
  const importRequest = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };

  try {
    const importing = provisionBusinessForAdmin(importRequest, adminEmail, {
      importer: async () => {
        importerStarted();
        await importerRelease;
        return importedDraft();
      },
      importMedia: async () => {
        mediaCalls += 1;
        return {
          logoUrl: null,
          coverImageUrl: null,
          galleryImageUrls: [],
          warnings: [],
        };
      },
    });
    const importRejection = assert.rejects(
      importing,
      (error: unknown) => error instanceof BusinessIdentityConflictError,
    );
    await importerBlocked;
    const manual = await provisionBusinessForAdmin(
      {
        name: 'Manual provisioning winner',
        type: 'BARBERSHOP',
        ownerName: null,
        ownerEmail: email,
        phoneIdentity: null,
        importUrl: null,
      },
      adminEmail,
    );
    releaseImporter();
    await importRejection;

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: manual.business.id },
      include: {
        services: true,
        workingHours: { where: { scope: 'BUSINESS' } },
      },
    });
    assert.equal(await prisma.business.count({ where: { ownerEmail: email } }), 1);
    assert.equal(business.name, 'Manual provisioning winner');
    assert.equal(business.type, 'BARBERSHOP');
    assert.equal(business.businessImportSourceUrl, null);
    assert.equal(business.businessImportDraft, null);
    assert.equal(business.businessImportedAt, null);
    assert.ok(business.services.length > 0);
    assert.equal(business.workingHours.length, 5);
    assert.equal(mediaCalls, 0);
  } finally {
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('first import rejects a previously provisioned owner-edited business without changes', async () => {
  const email = `business-import-existing-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  const manualRequest = {
    name: 'Prepared business',
    type: 'BARBERSHOP' as const,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: null,
  };
  let mediaCalls = 0;

  try {
    const { business } = await provisionBusinessForAdmin(manualRequest, adminEmail);
    const service = await prisma.service.findFirstOrThrow({
      where: { businessId: business.id },
    });
    const staff = await prisma.staffMember.findFirstOrThrow({
      where: { businessId: business.id },
    });
    await prisma.business.update({
      where: { id: business.id },
      data: {
        name: 'Owner edited business',
        description: 'Owner-authored profile',
        address: 'Owner address 12',
        listed: true,
      },
    });
    await prisma.businessSettings.update({
      where: { businessId: business.id },
      data: { onboardingCompleted: true },
    });
    await prisma.service.update({
      where: { id: service.id },
      data: { name: 'Owner edited service', priceAgorot: 7777 },
    });
    const client = await prisma.client.create({
      data: {
        businessId: business.id,
        name: 'Existing customer',
        phone: '0509999999',
      },
    });
    await prisma.appointment.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        staffId: staff.id,
        startAt: new Date('2030-01-01T10:00:00Z'),
        endAt: new Date('2030-01-01T10:30:00Z'),
        status: 'CONFIRMED',
        totalPriceAgorot: 7777,
        services: {
          create: {
            serviceId: service.id,
            nameSnapshot: 'Owner edited service',
            durationMinSnapshot: service.durationMin,
            priceAgorotSnapshot: 7777,
          },
        },
      },
    });
    const before = await prisma.business.findUniqueOrThrow({
      where: { id: business.id },
      select: {
        name: true,
        description: true,
        address: true,
        listed: true,
        businessImportSourceUrl: true,
        businessImportDraft: true,
        businessImportedAt: true,
        settings: { select: { onboardingCompleted: true } },
        services: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, priceAgorot: true },
        },
        workingHours: {
          where: { scope: 'BUSINESS' },
          orderBy: { weekday: 'asc' },
          select: { weekday: true, startMinute: true, endMinute: true },
        },
      },
    });

    await assert.rejects(
      provisionBusinessForAdmin(
        { ...manualRequest, importUrl: 'https://example.com/imported-business' },
        adminEmail,
        {
          importer: async () => importedDraft(),
          importMedia: async () => {
            mediaCalls += 1;
            return {
              logoUrl: null,
              coverImageUrl: null,
              galleryImageUrls: [],
              warnings: [],
            };
          },
        },
      ),
      (error: unknown) => error instanceof BusinessImportConflictError,
    );

    const after = await prisma.business.findUniqueOrThrow({
      where: { id: business.id },
      select: {
        name: true,
        description: true,
        address: true,
        listed: true,
        businessImportSourceUrl: true,
        businessImportDraft: true,
        businessImportedAt: true,
        settings: { select: { onboardingCompleted: true } },
        services: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, priceAgorot: true },
        },
        workingHours: {
          where: { scope: 'BUSINESS' },
          orderBy: { weekday: 'asc' },
          select: { weekday: true, startMinute: true, endMinute: true },
        },
      },
    });
    assert.deepEqual(after, before);
    assert.equal(mediaCalls, 0);
    assert.equal(
      await prisma.appointment.count({ where: { businessId: business.id } }),
      1,
    );
  } finally {
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('child edits before the import claim preserve services, hours, staff, and links', async () => {
  const email = `business-import-before-claim-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let releaseClaim!: () => void;
  let claimStarted!: () => void;
  let mediaCalls = 0;
  const claimRelease = new Promise<void>((resolve) => {
    releaseClaim = resolve;
  });
  const claimBlocked = new Promise<void>((resolve) => {
    claimStarted = resolve;
  });
  const request = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };

  try {
    const importing = provisionBusinessForAdmin(request, adminEmail, {
      importer: async () => importedDraft(),
      claimImport: async (input) => {
        claimStarted();
        await claimRelease;
        return claimBusinessImport(input);
      },
      importMedia: async () => {
        mediaCalls += 1;
        return {
          logoUrl: null,
          coverImageUrl: null,
          galleryImageUrls: [],
          warnings: [],
        };
      },
    });
    const importRejection = assert.rejects(
      importing,
      (error: unknown) => error instanceof BusinessImportConflictError,
    );
    await claimBlocked;
    const business = await prisma.business.findFirstOrThrow({
      where: { ownerEmail: email },
      include: {
        services: {
          orderBy: { sortOrder: 'asc' },
          include: { staffLinks: true },
        },
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });
    const service = business.services[0]!;
    const staff = business.staff[0]!;
    await prisma.$transaction([
      prisma.service.update({
        where: { id: service.id },
        data: { name: 'Owner service before claim', priceAgorot: 9123 },
      }),
      prisma.staffMember.update({
        where: { id: staff.id },
        data: { displayName: 'Owner staff before claim' },
      }),
      prisma.serviceStaff.deleteMany({
        where: { serviceId: service.id, staffId: staff.id },
      }),
      prisma.workingHours.deleteMany({
        where: { businessId: business.id, scope: 'BUSINESS' },
      }),
      prisma.workingHours.create({
        data: {
          businessId: business.id,
          scope: 'BUSINESS',
          weekday: 2,
          startMinute: 600,
          endMinute: 780,
          breaks: [],
        },
      }),
    ]);
    releaseClaim();
    await importRejection;

    const after = await prisma.business.findUniqueOrThrow({
      where: { id: business.id },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        staff: { orderBy: { createdAt: 'asc' } },
        workingHours: {
          where: { scope: 'BUSINESS' },
          orderBy: { weekday: 'asc' },
        },
      },
    });
    assert.equal(after.businessImportSourceUrl, null);
    assert.equal(after.businessImportDraft, null);
    assert.equal(after.businessImportedAt, null);
    assert.equal(after.services[0]?.name, 'Owner service before claim');
    assert.equal(after.services[0]?.priceAgorot, 9123);
    assert.equal(after.staff[0]?.displayName, 'Owner staff before claim');
    assert.equal(after.workingHours.length, 1);
    assert.equal(after.workingHours[0]?.weekday, 2);
    assert.equal(
      await prisma.serviceStaff.count({
        where: { serviceId: service.id, staffId: staff.id },
      }),
      0,
    );
    assert.equal(mediaCalls, 0);
  } finally {
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('child edits during media preserve services, hours, staff, and links', async () => {
  const email = `business-import-child-race-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let releaseMedia!: () => void;
  let mediaStarted!: () => void;
  const mediaRelease = new Promise<void>((resolve) => {
    releaseMedia = resolve;
  });
  const mediaClaimed = new Promise<void>((resolve) => {
    mediaStarted = resolve;
  });
  const request = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };

  try {
    const importing = provisionBusinessForAdmin(request, adminEmail, {
      importer: async () => importedDraft(),
      importMedia: async () => {
        mediaStarted();
        await mediaRelease;
        return {
          logoUrl: '/api/public/image?blob=imported-logo',
          coverImageUrl: '/api/public/image?blob=imported-cover',
          galleryImageUrls: ['/api/public/image?blob=imported-gallery'],
          warnings: [],
        };
      },
    });
    const importRejection = assert.rejects(
      importing,
      (error: unknown) => error instanceof BusinessImportConflictError,
    );
    await mediaClaimed;
    const business = await prisma.business.findFirstOrThrow({
      where: { ownerEmail: email },
      include: {
        services: {
          orderBy: { sortOrder: 'asc' },
          include: { staffLinks: true },
        },
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });
    const service = business.services[0]!;
    const staff = business.staff[0]!;
    await prisma.$transaction([
      prisma.service.update({
        where: { id: service.id },
        data: { name: 'Owner service during media', priceAgorot: 8345 },
      }),
      prisma.staffMember.update({
        where: { id: staff.id },
        data: { displayName: 'Owner staff during media' },
      }),
      prisma.serviceStaff.deleteMany({
        where: { serviceId: service.id, staffId: staff.id },
      }),
      prisma.workingHours.deleteMany({
        where: { businessId: business.id, scope: 'BUSINESS' },
      }),
      prisma.workingHours.create({
        data: {
          businessId: business.id,
          scope: 'BUSINESS',
          weekday: 4,
          startMinute: 660,
          endMinute: 840,
          breaks: [[720, 750]],
        },
      }),
    ]);
    releaseMedia();
    await importRejection;

    const after = await prisma.business.findUniqueOrThrow({
      where: { id: business.id },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        staff: { orderBy: { createdAt: 'asc' } },
        workingHours: {
          where: { scope: 'BUSINESS' },
          orderBy: { weekday: 'asc' },
        },
      },
    });
    assert.equal(after.businessImportedAt, null);
    assert.equal(after.logoUrl, null);
    assert.equal(after.coverImageUrl, null);
    assert.equal(after.description, null);
    assert.equal(after.services[0]?.name, 'Owner service during media');
    assert.equal(after.services[0]?.priceAgorot, 8345);
    assert.equal(after.staff[0]?.displayName, 'Owner staff during media');
    assert.equal(after.workingHours.length, 1);
    assert.equal(after.workingHours[0]?.weekday, 4);
    assert.equal(
      await prisma.serviceStaff.count({
        where: { serviceId: service.id, staffId: staff.id },
      }),
      0,
    );
  } finally {
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('an owner profile edit after the import claim wins without imported overwrites', async () => {
  const email = `business-import-race-${randomUUID()}@example.invalid`;
  const adminEmail = 'platform-admin@example.invalid';
  let releaseMedia!: () => void;
  let mediaStarted!: () => void;
  const mediaRelease = new Promise<void>((resolve) => {
    releaseMedia = resolve;
  });
  const mediaClaimed = new Promise<void>((resolve) => {
    mediaStarted = resolve;
  });
  const request = {
    name: null,
    type: null,
    ownerName: null,
    ownerEmail: email,
    phoneIdentity: null,
    importUrl: 'https://example.com/imported-business',
  };

  try {
    const importing = provisionBusinessForAdmin(request, adminEmail, {
      importer: async () => importedDraft(),
      importMedia: async () => {
        mediaStarted();
        await mediaRelease;
        return {
          logoUrl: null,
          coverImageUrl: null,
          galleryImageUrls: [],
          warnings: [],
        };
      },
    });
    await mediaClaimed;
    const claimed = await prisma.business.findFirstOrThrow({
      where: { ownerEmail: email },
    });
    await prisma.business.update({
      where: { id: claimed.id },
      data: {
        name: 'Owner wins race',
        description: 'Saved while import media was pending',
      },
    });
    releaseMedia();

    await assert.rejects(
      importing,
      (error: unknown) => error instanceof BusinessImportConflictError,
    );
    const after = await prisma.business.findUniqueOrThrow({
      where: { id: claimed.id },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        workingHours: {
          where: { scope: 'BUSINESS' },
          orderBy: { weekday: 'asc' },
        },
      },
    });
    assert.equal(after.name, 'Owner wins race');
    assert.equal(after.description, 'Saved while import media was pending');
    assert.equal(after.businessImportedAt, null);
    assert.ok(after.services.length > 1);
    assert.equal(after.workingHours.length, 5);
  } finally {
    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      select: { id: true },
    });
    await prisma.appointment.deleteMany({
      where: { businessId: { in: businesses.map(({ id }) => id) } },
    });
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});
