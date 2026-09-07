import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { prisma } from '../src/lib/db';
import { MAX_RENDERED_IMAGE_BYTES } from '../src/lib/media';

test('large legacy images stay outside full-page HTML and use bounded WebP variants', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await bookingFixture();
  try {
    const jpeg = await sharp(randomBytes(1600 * 1000 * 3), {
      raw: { width: 1600, height: 1000, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const legacy = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    const name = 'Synthetic </script><script>window.__legacyMediaExecuted=true</script>';
    const landingContent = {
      heroHeadline: name,
      heroSubtext: 'Synthetic full-page media regression',
      heroImages: [legacy],
      galleryImageUrls: [legacy, legacy],
      hotDeals: { title: 'Synthetic offer', images: [legacy] },
      about: 'Synthetic clinic description. '.repeat(25),
    };
    const originalGzipBytes = gzipSync(
      JSON.stringify({
        logoUrl: legacy,
        coverImageUrl: legacy,
        landingContent,
      }),
    ).length;
    expect(originalGzipBytes).toBeGreaterThan(2 * 1024 * 1024);
    await prisma.business.update({
      where: { id: fixture.business.id },
      data: {
        name,
        type: 'CLINIC',
        publicPageStyle: 'LANDING',
        logoUrl: legacy,
        coverImageUrl: legacy,
        landingContent,
        settings: { update: { onboardingCompleted: true } },
      },
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const response = await page.goto(`/b/${fixture.business.slug}`, {
      waitUntil: 'load',
    });
    expect(response?.status()).toBe(200);
    const html = await response!.body();
    const htmlGzipBytes = gzipSync(html).length;
    expect(htmlGzipBytes).toBeLessThan(100 * 1024);
    expect(html.toString()).not.toContain('data:image/jpeg;base64,');
    expect(await page.evaluate(() => '__legacyMediaExecuted' in window)).toBe(false);
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(jsonLd.some((text) => JSON.parse(text).name === name)).toBe(true);

    const hero = page
      .locator('img[fetchpriority="high"][src^="/api/public/image"]')
      .first();
    await expect(hero).toBeVisible();
    await expect
      .poll(() =>
        hero.evaluate((image) => {
          const img = image as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      )
      .toBe(true);
    await expect(hero).toHaveAttribute('loading', 'eager');
    await expect(hero).toHaveAttribute('srcset', /320w.*640w.*960w.*1600w/);
    const heroUrl = new URL(
      await hero.evaluate((image) => (image as HTMLImageElement).currentSrc),
    );
    expect(heroUrl.origin).toBe(new URL(BASE_URL).origin);
    const heroResponse = await page.request.get(heroUrl.href);
    expect(heroResponse.ok()).toBe(true);
    expect(heroResponse.headers()['content-type']).toContain('image/webp');
    const heroBytes = await heroResponse.body();
    expect(heroBytes.length).toBeLessThanOrEqual(MAX_RENDERED_IMAGE_BYTES);
    const dimensions = await sharp(heroBytes).metadata();
    expect(dimensions.width).toBeLessThanOrEqual(1600);
    expect(dimensions.height).toBeLessThanOrEqual(1600);
    const otherImages = page.locator(
      'img[src^="/api/public/image"]:not([fetchpriority="high"])',
    );
    expect(await otherImages.count()).toBeGreaterThan(0);
    for (const image of await otherImages.all())
      await expect(image).toHaveAttribute('loading', 'lazy');

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      return {
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      };
    });
    expect(response!.headers()['content-encoding']).toMatch(/gzip|br/);
    expect(navigation.encodedBodySize).toBeGreaterThan(0);
    expect(navigation.encodedBodySize).toBeLessThan(100 * 1024);
    expect(pageErrors).toEqual([]);
    await testInfo.attach('legacy-media-budgets.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            originalGzipBytes,
            htmlGzipBytes,
            ...navigation,
            heroBytes: heroBytes.length,
            heroWidth: dimensions.width,
            heroHeight: dimensions.height,
            note: 'Full navigation HTML includes its initial RSC payload; not a separate client-navigation RSC or production LCP measurement.',
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  } finally {
    await cleanupFixture(fixture);
  }
});
