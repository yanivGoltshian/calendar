import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from './fixtures';
import { updateBusinessProfile, type BusinessProfileInput } from '../src/server/repos/settings';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';

after(() => prisma.$disconnect());

test('concurrent partial branding edits preserve the latest other landing content', async () => {
  const f = await bookingFixture();
  try {
    const original = {
      presentation: 'premium', heroHeadline: 'Preserved headline',
      sections: { highlights: false, socialCta: false },
      heroVideoUrl: '/images/retained-video.mp4',
    };
    await prisma.business.update({ where: { id: f.business.id }, data: { landingContent: original } });
    const theme = BRAND_PRESETS[3].theme;
    const profile: BusinessProfileInput = {
      name: f.business.name, type: f.business.type, phone: f.business.phone,
      address: f.business.address, description: f.business.description,
      instagramUrl: f.business.instagramUrl, logoUrl: f.business.logoUrl,
      coverImageUrl: f.business.coverImageUrl, brandColor: theme.brand, timezone: f.business.timezone,
    };
    await Promise.all([
      updateBusinessProfile(f.business.id, profile, { theme }),
      updateBusinessProfile(f.business.id, profile, { heroImages: ['/icons/icon-192.png'] }),
      updateBusinessProfile(f.business.id, profile, { announcement: 'Holiday hours' }),
      updateBusinessProfile(f.business.id, profile, { googleReviewsUrl: 'https://maps.app.goo.gl/example' }),
    ]);
    const saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
    assert.deepEqual(saved.landingContent, {
      ...original, theme, heroImages: ['/icons/icon-192.png'],
      announcement: 'Holiday hours', googleReviewsUrl: 'https://maps.app.goo.gl/example',
    });
    await updateBusinessProfile(f.business.id, profile, { theme: undefined });
    assert.deepEqual((await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      saved.landingContent);
    await updateBusinessProfile(f.business.id, profile, { announcement: null, googleReviewsUrl: null });
    assert.deepEqual((await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      { ...original, theme, heroImages: ['/icons/icon-192.png'] });
  } finally {
    await cleanupFixture(f);
  }
});
