import sharp from 'sharp';
import { prisma } from '../src/lib/db';
import { cleanupFixture } from '../integration/fixtures';
import { OG_CARD_PATH } from '../src/lib/seo';
import { businessSharePath } from '../src/lib/booking-link';
import { publicMediaContent } from '../src/server/media/publicContent';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { visualFixture } from './visualFixtures';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`business sharing uses only the saved logo with a deterministic cache key at ${width}px`, async ({
    page,
    request,
  }, info) => {
    const fixture = await visualFixture();
    const noLogo = await visualFixture({ basic: true });
    try {
      await prisma.business.update({
        where: { id: noLogo.business.id },
        data: { logoUrl: null },
      });
      const businessPath = businessSharePath(
        fixture.business.slug,
        fixture.business.logoUrl,
      );
      const bookingPath = businessSharePath(
        fixture.business.slug,
        fixture.business.logoUrl,
        'booking',
      );
      const projectedLogoUrl = publicMediaContent({
        logoUrl: fixture.business.logoUrl,
      }, fixture.business.slug).logoUrl;
      expect(projectedLogoUrl).toBeTruthy();
      const expectedLogoUrl = new URL(projectedLogoUrl!, BASE_URL).toString();
      const expectedBusinessShareUrl = new URL(businessPath, BASE_URL).toString();
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`/b/${fixture.business.slug}`);

      const share = page.getByRole('region', {
        name: new RegExp(fixture.business.name),
      });
      await expect(share).toContainText(expectedBusinessShareUrl);
      const whatsapp = share.getByRole('link', { name: 'וואטסאפ', exact: true });
      await expect(whatsapp).toHaveAttribute(
        'href',
        new RegExp(encodeURIComponent(expectedBusinessShareUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );

      for (const path of [businessPath, bookingPath]) {
        await page.goto(path);
        const logoUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
        expect(logoUrl).toBe(expectedLogoUrl);
        await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
          'content',
          expectedLogoUrl,
        );
        const logo = await request.get(logoUrl!);
        expect(logo.ok()).toBe(true);
        const body = await logo.body();
        const metadata = await sharp(body).metadata();
        expect([metadata.width, metadata.height]).toEqual([120, 90]);
        const { data } = await sharp(body).raw().toBuffer({ resolveWithObject: true });
        for (const [channel, expected] of [165, 120, 97].entries()) {
          expect(Math.abs(data[channel] - expected)).toBeLessThanOrEqual(3);
        }
        await info.attach(`saved-logo-${width}.webp`, {
          body,
          contentType: logo.headers()['content-type'] ?? 'image/webp',
        });
      }

      const textOnlyPath = businessSharePath(noLogo.business.slug, null);
      const expectedTextOnlyUrl = new URL(textOnlyPath, BASE_URL).toString();
      await page.goto(`/b/${noLogo.business.slug}`);
      await expect(page.getByRole('region', {
        name: new RegExp(noLogo.business.name),
      })).toContainText(expectedTextOnlyUrl);
      await page.goto(textOnlyPath);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
      await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(0);

      await page.goto('/');
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        new RegExp(`${OG_CARD_PATH.replace('.', '\\.')}$`),
      );
    } finally {
      await cleanupFixture(fixture);
      await cleanupFixture(noLogo);
    }
  });
}
