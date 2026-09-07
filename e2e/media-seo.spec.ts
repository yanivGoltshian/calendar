import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { formatDateString } from '../src/lib/time';
import { legacyImageHash } from '../src/server/media/publicContent';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { measureMobilePages } from './mobilePerformance';
import { BUSINESS_SLUG } from './helpers';

test('real cached Next page bounds legacy SSR/images and hydrates calendar dates across midnight', async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const f = await bookingFixture();
  try {
    const image = await sharp(randomBytes(1600 * 1200 * 3), {
      raw: { width: 1600, height: 1200, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const legacy = `data:image/jpeg;base64,${image.toString('base64')}`;
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        publicPageStyle: 'LANDING',
        coverImageUrl: legacy,
        logoUrl: legacy,
        landingContent: {
          heroHeadline: 'Synthetic legacy performance',
          heroImages: [legacy, legacy],
          galleryImageUrls: [legacy, legacy],
          hotDeals: { images: [legacy] },
        },
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
    const response = await context.request.get(`/b/${f.business.slug}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const compressedBytes = gzipSync(html).length;
    expect(html).not.toMatch(/data:image\/(?:jpeg|png|webp);base64,/);
    expect(Buffer.byteLength(html)).toBeLessThan(400 * 1024);
    expect(compressedBytes).toBeLessThan(100 * 1024);
    const media = await context.request.get(
      `/api/public/image?business=${f.business.slug}&asset=${legacyImageHash(legacy)}&w=1600`,
    );
    expect(media.status()).toBe(200);
    expect(media.headers()['content-type']).toBe('image/webp');
    const rendered = await media.body();
    expect(rendered.length).toBeLessThanOrEqual(250 * 1024);
    expect((await sharp(rendered).metadata()).width).toBeLessThanOrEqual(1600);

    const hydrationErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (/hydrat|#418|#425/i.test(error.message)) hydrationErrors.push(error.message);
    });
    const browserTime = new Date(Date.now() + 3 * 86_400_000);
    await page.clock.setFixedTime(browserTime);
    await page.goto(`/b/${f.business.slug}`);
    const continuation = page.locator(`a[href^="/b/${f.business.slug}/book?"]`).first();
    await expect(continuation).toHaveAttribute(
      'href',
      new RegExp(`date=${formatDateString(browserTime, f.business.timezone)}`),
    );
    const tomorrow = new Date(browserTime.getTime() + 86_400_000);
    await page.clock.setFixedTime(tomorrow);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await expect(continuation).toHaveAttribute(
      'href',
      new RegExp(`date=${formatDateString(tomorrow, f.business.timezone)}`),
    );
    expect(hydrationErrors).toEqual([]);
    await testInfo.attach('legacy-media-budgets', {
      body: JSON.stringify({
        sourceImageBytes: image.length,
        decodedHtmlBytes: Buffer.byteLength(html),
        compressedHtmlBytes: compressedBytes,
        optimizedHeroBytes: rendered.length,
      }),
      contentType: 'application/json',
    });
    const performance = await measureMobilePages(browser, ['/', `/b/${BUSINESS_SLUG}`, `/b/${f.business.slug}`]);
    console.log(`mobile performance: ${JSON.stringify(performance)}`);
    await testInfo.attach('mobile-production-performance.json', {
      body: JSON.stringify(performance, null, 2), contentType: 'application/json',
    });
  } finally {
    await cleanupFixture(f);
  }
});
