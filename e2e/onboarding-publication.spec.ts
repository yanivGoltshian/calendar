import { encode } from 'next-auth/jwt';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';
import { normalizeLandingContent, landingDefaults } from '../src/lib/publicPageStyle';
import { HERO_VIDEO } from './visualFixtures';
import { t } from '../src/i18n';
import { DEFAULT_BRAND, getTemplateDef } from '../src/server/messages/registry';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`premium publication keeps media and logo after optional skips at ${width}px`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(15_000);
    const f = await bookingFixture();
    const original = {
      theme: BRAND_PRESETS.find(preset => preset.id === 'black-gold')!.theme,
      heroImages: ['/icons/icon-192.png'],
      heroVideoUrl: HERO_VIDEO,
      galleryImageUrls: ['/icons/icon-192.png'],
      socialLinks: { instagram: 'https://instagram.com/synthetic' },
    };
    try {
      await prisma.business.update({ where: { id: f.business.id }, data: {
        type: 'BARBERSHOP', plan: 'basic', subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000), paidUntil: null, brandColor: '#3a3a3a',
        publicPageStyle: 'LANDING', logoUrl: null, landingContent: original,
      } });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/b/${f.business.slug}`);
      // Authored media must render even before a logo or completion marker exists.
      await expect(page.locator('header video')).toBeVisible();
      const token = await encode({
        token: { email: f.business.ownerEmail }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      await page.goto('/admin/onboarding?edit=premium');
      await expect(page.locator('form.pw-phone')).toBeVisible();
      await page.locator('.pw-step .pw-tile').first()
        .getByRole('button', { name: t.admin.settings.profile.image.remove, exact: true }).click();
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(0);
      let uploads = 0;
      await page.route('**/api/upload/media', route => route.fulfill({
        json: { url: ++uploads === 1 ? '/icons/icon-192.png' : '/icons/icon-512.png' },
      }));
      const buffer = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#334455' } }).png().toBuffer();
      const file = { name: 'synthetic.png', mimeType: 'image/png', buffer };
      const chooser = page.waitForEvent('filechooser');
      await page.locator('.pw-step .pw-tile').last().click();
      await (await chooser).setFiles(file);
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(1);
      const secondChooser = page.waitForEvent('filechooser');
      await page.locator('.pw-step .pw-tile').last()
        .getByRole('button', { name: t.admin.onboarding.premium.editor.uploadLabel, exact: true }).click();
      await (await secondChooser).setFiles(file);
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(2);
      await page.locator('.pw-step .pw-tile').first()
        .getByRole('button', { name: t.admin.settings.profile.image.remove, exact: true }).click();
      await expect(page.locator('.pw-step .pw-tile img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.getByRole('button', { name: t.admin.onboarding.premium.editor.useAsLogo, exact: true }).click();
      await page.locator('.pw-next').click();
      await page.locator('.pw-skip').click(); // Social content is explicitly omitted.
      await page.locator('.pw-skip').click(); // Skipped deals must not materialize preview defaults.
      await expect(page.getByTestId('premium-logo').locator('img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.locator('.pw-next').click();
      await page.locator('.pw-skip').click();
      await expect(page.locator('.pw-preview .pv-why')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pw-cube')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pv-social')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pv-logo img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.presentation).toBe('premium');
      const saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id }, include: { settings: true } });
      const content = normalizeLandingContent(saved.landingContent)!;
      expect(saved.logoUrl).toBe('/icons/icon-512.png');
      expect(saved.settings?.onboardingCompleted).toBe(true);
      expect(content.heroVideoUrl).toBe(HERO_VIDEO);
      expect(content.galleryImageUrls).toEqual(['/icons/icon-512.png']);
      expect(content.sections?.highlights).toBe(false);
      expect(content.benefits).toBeUndefined();
      expect(content.socialLinks).toBeUndefined();
      expect(content.hotDeals).toBeUndefined();
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('header video')).toBeVisible();
      await expect.poll(() => page.locator('header video').evaluate((video: HTMLVideoElement) =>
        !video.paused && video.currentTime > 0 && video.videoWidth > 0)).toBe(true);
      await expect(page.locator('header').getByRole('img', { name: f.business.name, exact: true })).toBeVisible();
      await expect(page.locator('header a[href="#lp-offers"]')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.highlightsTitle, exact: true })).toHaveCount(0);
      const logo = page.locator('header img').first();
      await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await info.attach(`published-${width}.png`, { body: await page.screenshot(), contentType: 'image/png' });
      // Reopening preserves exclusion; Continue explicitly accepts the shown defaults.
      await page.goto('/admin/onboarding?edit=premium');
      await page.locator('.pw-pip').nth(4).click();
      await page.locator('.pw-next').click();
      await expect(page.locator('.pw-preview .pv-why')).toBeVisible();
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.sections?.highlights).toBe(true);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.highlightsTitle, exact: true })).toBeVisible();
      await expect(page.getByText(landingDefaults('BARBERSHOP').benefits[0].title, { exact: true })).toBeVisible();
      await page.goto('/admin/onboarding?edit=premium');
      await page.locator('.pw-pip').nth(3).click();
      await page.locator('.pw-skip').click();
      await page.locator('.pw-next').click();
      await expect(page.locator('.pw-preview .pv-hero p')).toBeEmpty();
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.sections?.hero).toBe(false);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('header video')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.business.name);
      await expect(page.getByText(landingDefaults('BARBERSHOP').heroSubtext, { exact: true })).toHaveCount(0);
      await expect(page.locator('header a[href="#lp-location"]')).toHaveCount(0);
      await page.goto('/admin/settings');
      const message = page.getByTestId('message-template-booking_confirmation-email');
      const preview = message.getByTestId('message-preview');
      await expect(preview).toContainText(f.business.name);
      await expect(preview).toContainText(DEFAULT_BRAND);
      await expect(preview).not.toContainText('{{');
      await message.locator('summary').click();
      const subject = message.locator('input[name$=".subject"]');
      await subject.fill('Preview {{businessName}}');
      await expect(preview).toContainText(`Preview ${f.business.name}`);
      await expect(subject).toHaveValue('Preview {{businessName}}');
      await message.getByRole('button', { name: t.admin.settings.messageTemplates.reset, exact: true }).click();
      await expect(subject).toHaveValue(getTemplateDef('booking_confirmation').channels.email!.subject!);
      await expect(preview).toContainText(DEFAULT_BRAND);
    } finally {
      await cleanupFixture(f);
    }
  });
}
