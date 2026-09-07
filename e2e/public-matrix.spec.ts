import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { cleanupFixture } from '../integration/fixtures';
import { VIEWPORTS, visualFixture } from './visualFixtures';
import { t } from '../src/i18n';
import sharp from 'sharp';

test.afterAll(() => prisma.$disconnect());

for (const width of VIEWPORTS) {
  test(`public page matrix and navigation at ${width}px RTL`, async ({ page }, info) => {
    const basic = await visualFixture({ basic: true });
    const rich = await visualFixture();
    await page.setViewportSize({ width, height: 844 });
    try {
      for (const [name, path] of [
        ['home', '/'],
        ['demo', '/b/demo-barbershop'],
        ['clinic', '/b/skin-beauty'],
        ['basic', `/b/${basic.business.slug}`],
        ['published', `/b/${rich.business.slug}`],
      ]) {
        await test.step(name, async () => {
          await page.goto(path);
          await expect(page.locator('h1').first()).toBeVisible();
          expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          if (name === 'clinic') {
            const hero = page.locator('header section').first();
            const video = hero.locator('video');
            await expect(video).toHaveAttribute(
              'src',
              '/images/clinic/videos/clinic-hero.mp4',
            );
            await expect
              .poll(() =>
                video.evaluate(
                  (v: HTMLVideoElement) =>
                    !v.paused && v.currentTime > 0.1 && v.videoWidth > 0,
                ),
              )
              .toBe(true);
            await video.evaluate(async (v: HTMLVideoElement) => {
              v.pause();
              if (Math.abs(v.currentTime - 0.5) > 0.01) {
                await new Promise<void>((resolve) => {
                  v.addEventListener('seeked', () => resolve(), { once: true });
                  v.currentTime = 0.5;
                });
              }
            });
            await info.attach(`clinic-repository-hero-${width}.png`, {
              body: await hero.screenshot({ animations: 'disabled' }),
              contentType: 'image/png',
            });
          }
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          if (name === 'published') {
            const comparison = page.getByRole('slider').first();
            await comparison.scrollIntoViewIfNeeded();
            await comparison.fill('25');
            await expect(comparison).toHaveValue('25');
            await page.locator('summary').filter({ hasText: 'כיצד קובעים תור?' }).click();
            await expect(
              page.getByText('בוחרים שירות ושעה וממשיכים לאישור.', { exact: true }),
            ).toBeVisible();
            for (const image of await page.locator('img:visible').all()) {
              await image.scrollIntoViewIfNeeded();
              await expect
                .poll(() =>
                  image.evaluate(
                    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
                  ),
                )
                .toBe(true);
            }
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await info.attach(`${name}-${width}.png`, {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png',
          });
          if (name === 'home') {
            if (width < 1024) {
              await page.getByRole('button', { name: t.marketing.nav.openMenu }).click();
              await page.locator('header a[href="#features"]:visible').click();
              await expect(
                page.getByRole('button', { name: t.marketing.nav.openMenu }),
              ).toBeVisible();
            } else {
              await page.locator('header a[href="#features"]').click();
            }
            await expect(page).toHaveURL(/#features$/);
            await expect(page.locator('#features')).toBeInViewport();
          } else {
            // Reach the persistent booking CTA after scrolling the complete landing.
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.locator(`a[href="${path}/book"]:visible`).last().click();
            await expect(page).toHaveURL(new RegExp(`${path}/book$`));
            await expect(
              page.getByText(t.booking.chooseServices, { exact: true }),
            ).toBeVisible();
          }
        });
      }
    } finally {
      await cleanupFixture(basic);
      await cleanupFixture(rich);
    }
  });
}

test('install guidance, keyboard dismissal and generated PWA icons work with legacy logos', async ({
  page,
  request,
}, info) => {
  const f = await visualFixture();
  try {
    await page.goto(`/b/${f.business.slug}`);
    const install = page.getByRole('button', { name: t.install.button, exact: true });
    await install.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await info.attach('install-dialog.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await install.click();
    await page.getByRole('button', { name: t.install.close, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifestResponse = await request.get(manifestHref!);
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toMatch(/^image\//);
      const metadata = await sharp(await response.body()).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBeGreaterThan(0);
    }
    const og = await request.get(`/b/${f.business.slug}/opengraph-image`);
    expect(og.ok()).toBe(true);
    const metadata = await sharp(await og.body()).metadata();
    expect(metadata.format).toBe('png');
    expect([metadata.width, metadata.height]).toEqual([1200, 630]);
  } finally {
    await cleanupFixture(f);
  }
});

test('anonymous admin navigation remains gated and public customer login channels remain usable', async ({
  page,
}, info) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/business\/login/);
  await page.getByRole('link', { name: t.business.login.clientCta, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: t.auth.methodEmail, exact: true }).click();
  await expect(page.locator('input[type=email]')).toBeVisible();
  await page.getByRole('button', { name: t.auth.methodPhone, exact: true }).click();
  await expect(page.locator('input[type=tel]')).toBeVisible();
  await info.attach('customer-login.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  const response = await page.goto('/superadmin');
  // App Router may already have streamed a 200 before notFound resolves.
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.getByText(t.brand.states.notFoundTitle, { exact: true }),
  ).toBeVisible();
});
