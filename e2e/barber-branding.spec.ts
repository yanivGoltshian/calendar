import sharp from 'sharp';
import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';
import { HERO_VIDEO } from './visualFixtures';
import { t } from '../src/i18n';
import { canAcceptPublicBookings } from '../src/server/subscription';

const blue = BRAND_PRESETS.find((preset) => preset.id === 'clinical-blue')!.theme;
const profiles = ['persisted-barber', 'explicit-booking', 'rich-blue', 'partial-new'] as const;
test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  for (const profile of profiles) {
    test(`${profile} preserves blue branding and owned logo at ${width}px`, async ({ page, request }, info) => {
      const f = await bookingFixture();
      const partial = profile === 'partial-new';
      const rich = profile === 'rich-blue';
      const themeOnly = profile === 'persisted-barber';
      const logo = '/brand/business/demo-barbershop.png';
      try {
        const business = await prisma.business.update({
          where: { id: f.business.id },
          data: {
            name: 'מספרת הבית',
            type: 'BARBERSHOP',
            plan: 'basic',
            subscriptionStatus: 'trialing',
            trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
            paidUntil: null,
            brandColor: blue.brand,
            logoUrl: partial ? null : themeOnly ? `https://bundled-assets.example.invalid${logo}` : logo,
            publicPageStyle: profile === 'explicit-booking' ? 'BOOKING' : 'LANDING',
            landingContent: partial ? { heroHeadline: 'עסק חדש' } : themeOnly ? { theme: blue } : {
              theme: blue, heroHeadline: 'תספורת שמרגישים בה בבית',
              heroImages: [logo], heroVideoUrl: HERO_VIDEO,
            },
            settings: {
              update: {
                onboardingCompleted: !partial,
                onboardingSteps: { services: true, hours: !partial, branding: !partial, richContent: !partial },
              },
            },
          },
        });
        expect(canAcceptPublicBookings(business)).toBe(true);
        await page.setViewportSize({ width, height: 844 });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        if (themeOnly) {
          // Only the browser's direct InstallApp image gets a local transport stub.
          // The server-side alias remains nonresolving and must use owned-file mapping.
          const bundledLogo = await request.get(logo);
          expect(bundledLogo.ok()).toBe(true);
          await page.route(`https://bundled-assets.example.invalid${logo}`, (route) =>
            route.fulfill({ response: bundledLogo }));
        }
        await page.goto(`/b/${business.slug}`);
        const main = page.locator('main');
        const header = main.locator(':scope > header');
        await expect(header).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect.poll(() => main.locator('img').evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.complete))).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (rich) {
          await expect.poll(() => header.locator('video').evaluate((el: HTMLVideoElement) =>
            !el.paused && el.currentTime > 0 && el.videoWidth > 0)).toBe(true);
        }
        const evidence = await main.evaluate((element) => ({
          style: element.getAttribute('style'),
          richHeader: element.querySelector('header section') != null,
          images: [...element.querySelectorAll<HTMLImageElement>('img')].map((image) => ({
            src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0,
          })),
        }));
        await info.attach(`${profile}-${width}-presentation.json`, {
          body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json',
        });
        await info.attach(`${profile}-${width}.png`, {
          body: await page.screenshot({ animations: 'disabled', fullPage: true }),
          contentType: 'image/png',
        });
        expect(await main.evaluate((el) => getComputedStyle(el).getPropertyValue('--biz').trim())).toBe(blue.brand);
        if (!partial) {
          expect(await main.evaluate((el) => getComputedStyle(el).getPropertyValue('--biz-strong').trim())).toBe(blue.brandDark);
          expect(await main.evaluate((el) => getComputedStyle(el).getPropertyValue('--c-gold').trim())).toBe(blue.gold);
        }
        expect(evidence.richHeader).toBe(rich);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await main.locator('img').evaluateAll((images: HTMLImageElement[]) =>
          Promise.all(images.map((image) => image.decode())));
        if (!partial) {
          const image = header.locator(`img[alt="${business.name}"]`).first();
          await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
          const response = await request.get(await image.evaluate((el: HTMLImageElement) => el.currentSrc));
          expect(response.ok()).toBe(true);
          const bytes = await response.body();
          expect((await sharp(bytes).metadata()).format).toBe('webp');
          const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
          expect([decoded.info.width, decoded.info.height]).toEqual([320, 320]);
        }
        if (rich) {
          const topCta = header.locator(`a[href="/b/${business.slug}/book"]`).first();
          const heroCta = header.locator('section').locator(`a[href="/b/${business.slug}/book"]`);
          expect(await topCta.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('143, 185, 223');
          expect(await heroCta.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('59, 130, 196');
        } else {
          expect(await header.locator(':scope > div').first().evaluate((el) => getComputedStyle(el).backgroundImage))
            .toContain('59, 130, 196');
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const bookingCta = page.locator(`a[href="/b/${business.slug}/book"]:visible`).last();
        const ctaGradient = await bookingCta.evaluate((el) => getComputedStyle(el).backgroundImage);
        expect(ctaGradient).toContain('59, 130, 196');
        expect(ctaGradient).not.toContain('140, 103, 72');
        await bookingCta.click();
        await expect(page).toHaveURL(new RegExp(`/b/${business.slug}/book$`));
        await expect(page.getByText(t.booking.chooseServices, { exact: true })).toBeVisible();
        expect(errors).toEqual([]);
      } finally {
        await cleanupFixture(f);
      }
    });
  }
}
