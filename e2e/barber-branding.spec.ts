import sharp from 'sharp';
import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';
import { HERO_VIDEO } from './visualFixtures';
import { t } from '../src/i18n';
import { canAcceptPublicBookings } from '../src/server/subscription';
import { publicLandingThemeVars } from '../src/server/publicPagePresentation';
import { contrastRatio } from '../src/lib/brandColor';
import { formatAgorot } from '../src/lib/money';

const blue = BRAND_PRESETS.find((preset) => preset.id === 'clinical-blue')!.theme;
const bronze = BRAND_PRESETS.find((preset) => preset.id === 'skin-bronze')!.theme;
const pink = BRAND_PRESETS.find((preset) => preset.id === 'soft-rose')!.theme;
const blueVars = publicLandingThemeVars(blue);
const pinkVars = publicLandingThemeVars(pink);
const profiles = ['persisted-barber', 'explicit-booking', 'rich-blue', 'partial-new'] as const;
test.afterAll(() => prisma.$disconnect());

function rgb(hex: string) {
  const value = hex.slice(1);
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
}

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
            brandColor: partial ? blue.brand : bronze.brand,
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
        if (themeOnly) {
          expect(await main.evaluate((el) => getComputedStyle(el).getPropertyValue('--biz-text').trim()))
            .toBe(blueVars['--biz-text']);
          for (const [section, surface] of [
            ['services', 'a'],
            ['highlights', ':scope > div > div'],
            ['location', 'ul'],
          ] as const) {
            const rendered = page.locator(`[data-palette-surface="${section}"]`).locator(surface).first();
            await expect(rendered).toBeVisible();
            await expect(rendered).toHaveCSS('background-color', rgb(blueVars['--c-surface']));
          }
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

  test(`brand-only booking keeps light custom colors readable at ${width}px`, async ({ page }) => {
    const f = await bookingFixture();
    const staffTitle = 'Synthetic light-brand title';
    try {
      await Promise.all([
        prisma.business.update({
          where: { id: f.business.id },
          data: {
            brandColor: '#ffffff',
            publicPageStyle: 'BOOKING',
          },
        }),
        prisma.staffMember.update({
          where: { id: f.staff.id },
          data: { title: staffTitle },
        }),
      ]);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/b/${f.business.slug}`);

      const main = page.locator('main');
      const colors = await main.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          text: styles.getPropertyValue('--biz-ink-strong').trim(),
          surface: styles.getPropertyValue('--c-surface').trim(),
        };
      });
      expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
      await expect(page.getByText(formatAgorot(f.service.priceAgorot), { exact: true }))
        .toHaveCSS('color', rgb(colors.text));
      await expect(page.getByText(staffTitle, { exact: true })).toHaveCSS('color', rgb(colors.text));
    } finally {
      await cleanupFixture(f);
    }
  });

  test(`premium sections use the saved pink palette at ${width}px`, async ({ page }, info) => {
    const f = await bookingFixture();
    const image = '/icons/icon-192.png';
    const landingContent = {
      presentation: 'premium' as const,
      theme: pink,
      announcement: 'Synthetic palette announcement',
      heroEyebrow: 'Synthetic eyebrow',
      heroHeadline: 'Synthetic pink palette',
      heroSubtext: 'Every rendered section inherits the saved palette.',
      heroImages: [image],
      launchOffer: { text: 'Synthetic launch offer', spotsLeft: 4, endsAt: '2099-12-31' },
      hotDeals: { eyebrow: 'Synthetic deals', title: 'Synthetic promotion', images: [image] },
      benefits: [{ title: 'Benefit', text: 'Palette coverage' }],
      galleryImageUrls: [image],
      beforeAfter: [{ beforeUrl: image, afterUrl: image, label: 'Synthetic result' }],
      testimonials: [{ name: 'Synthetic customer', quote: 'Palette matched.' }],
      faq: [{ question: 'Palette question?', answer: 'Palette answer.' }],
      about: 'Synthetic palette coverage copy.',
      socialLinks: {
        whatsapp: '0501234567',
        instagram: 'https://instagram.com/synthetic',
      },
      sections: {
        highlights: true,
        services: true,
        gallery: true,
        beforeAfter: true,
        testimonials: true,
        faq: true,
        about: true,
        location: true,
        socialCta: true,
      },
    };
    try {
      await prisma.business.update({
        where: { id: f.business.id },
        data: {
          name: 'עסק בדיקת פלטה',
          type: 'BEAUTY_COSMETICS',
          address: 'רחוב הבדיקה 1, תל אביב',
          phone: '0501234567',
          brandColor: bronze.brand,
          logoUrl: image,
          publicPageStyle: 'LANDING',
          landingContent,
          settings: {
            update: {
              onboardingCompleted: true,
              onboardingSteps: {
                services: true,
                workingHours: true,
                branding: true,
                landing: true,
              },
            },
          },
        },
      });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/b/${f.business.slug}`);

      const main = page.locator('main');
      await expect(page.locator('[data-palette-surface="premium-header"]')).toBeVisible();
      const variables = await main.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          brand: styles.getPropertyValue('--c-brand').trim(),
          gold: styles.getPropertyValue('--c-gold').trim(),
          cream: styles.getPropertyValue('--c-cream').trim(),
          ink: styles.getPropertyValue('--c-ink').trim(),
          accent: styles.getPropertyValue('--c-accent').trim(),
        };
      });
      expect(variables).toEqual({
        brand: pink.brand,
        gold: pink.gold,
        cream: pink.cream,
        ink: pink.ink,
        accent: pink.accent,
      });
      const inheritedSections = await main.locator('section').evaluateAll((sections) =>
        sections.map((section) => {
          const styles = getComputedStyle(section);
          return {
            brand: styles.getPropertyValue('--c-brand').trim(),
            gold: styles.getPropertyValue('--c-gold').trim(),
            cream: styles.getPropertyValue('--c-cream').trim(),
          };
        }),
      );
      expect(inheritedSections.length).toBeGreaterThanOrEqual(10);
      expect(inheritedSections.every((theme) =>
        theme.brand === pink.brand && theme.gold === pink.gold && theme.cream === pink.cream,
      )).toBe(true);

      const headerCta = page.locator('header').locator(`a[href="/b/${f.business.slug}/book"]`).first();
      const heroOverlay = page.locator('[data-palette-overlay="hero"]');
      const bookingAccent = page.locator('[data-palette-accent="booking"]');
      const promotion = page.locator('[data-palette-surface="promotion"]');
      const location = page.locator('[data-palette-surface="location"]');
      const share = page.locator('[data-palette-surface="share"]');
      const stickyCta = page.locator('[data-palette-surface="sticky-booking"]');

      await expect(location).toBeVisible();
      expect(await headerCta.evaluate((element) => getComputedStyle(element).backgroundImage))
        .toContain(rgb(pinkVars['--c-gold-action']));
      const heroOverlayGradient = await heroOverlay.evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(heroOverlayGradient).toContain('36, 26, 30');
      expect(heroOverlayGradient).not.toContain('44, 37, 34');
      const bookingGradient = await bookingAccent.evaluate((element) => getComputedStyle(element).backgroundImage);
      for (const color of [pink.gold, pink.accent, pink.brand]) {
        expect(bookingGradient).toContain(rgb(color));
      }
      for (const surface of [promotion, location]) {
        const background = await surface.evaluate((element) => getComputedStyle(element).backgroundImage);
        expect(background).toContain('224, 179, 191');
        expect(background).not.toContain('198, 168, 106');
      }
      await expect(share).toHaveCSS('background-color', rgb(pink.cream));
      const stickyGradient = await stickyCta.evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(stickyGradient).toContain(rgb(pinkVars['--c-brand-action']));
      expect(stickyGradient).toContain(rgb(pinkVars['--c-brand-action-strong']));
      expect(stickyGradient).not.toContain(rgb(bronze.brandDark));

      await info.attach(`pink-header-${width}.png`, {
        body: await page.locator('[data-palette-surface="premium-header"]').screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await info.attach(`pink-promotion-${width}.png`, {
        body: await promotion.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await info.attach(`pink-location-${width}.png`, {
        body: await location.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      const { theme: _theme, ...contentWithoutTheme } = landingContent;
      const fallback = await bookingFixture();
      try {
        await prisma.business.update({
          where: { id: fallback.business.id },
          data: {
            name: 'עסק בדיקת ברירת מחדל',
            type: 'BEAUTY_COSMETICS',
            address: 'רחוב הבדיקה 1, תל אביב',
            phone: '0501234567',
            brandColor: bronze.brand,
            logoUrl: image,
            publicPageStyle: 'LANDING',
            landingContent: contentWithoutTheme,
            settings: {
              update: {
                onboardingCompleted: true,
                onboardingSteps: {
                  services: true,
                  workingHours: true,
                  branding: true,
                  landing: true,
                },
              },
            },
          },
        });
        await page.goto(`/b/${fallback.business.slug}`);
        await expect(page.locator('[data-palette-surface="premium-header"]')).toBeVisible();
        expect(await page.locator('main').evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--c-gold').trim(),
        )).toBe(bronze.gold);
        expect(await page.locator('main').evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--c-hero-cta').trim(),
        )).toBe(bronze.accent);
      } finally {
        await cleanupFixture(fallback);
      }
    } finally {
      await cleanupFixture(f);
    }
  });
}
