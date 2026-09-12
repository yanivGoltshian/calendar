import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { t } from '../src/i18n';

for (const width of [390, 1366]) {
  test(`both homepage demo buttons navigate to the complete clinic at ${width}px`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    const failedAssets: string[] = [];
    const chooserVisits: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === new URL(BASE_URL).origin && response.status() >= 400 &&
          /^(?:\/_next\/|\/api\/public\/image|\/images\/|\/brand\/)/.test(url.pathname)) {
        failedAssets.push(`${response.status()} ${url.pathname}`);
      }
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/demo') {
        chooserVisits.push(frame.url());
      }
    });
    for (const position of [0, 1]) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const buttons = page.getByRole('link', { name: t.marketing.hero.secondaryCta, exact: true });
      await expect(buttons).toHaveCount(2);
      for (const button of await buttons.all()) await expect(button).toHaveAttribute('href', '/b/skin-beauty');
      await buttons.nth(position).click();
      await expect(page).toHaveURL(`${BASE_URL}/b/skin-beauty`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const hero = page.locator('header section').first();
      await expect(hero).toBeVisible();
      await expect(hero).toHaveCSS('position', 'relative');
      const video = hero.locator('video');
      await expect(video).toHaveAttribute('src', '/images/clinic/videos/clinic-hero.mp4');
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
        !element.paused && element.currentTime > 0 && element.videoWidth > 0)).toBe(true);
      for (const image of await page.locator('main img:visible').all()) {
        // Gallery faces keep rotating; scrolling must not wait for their animation to stop.
        await image.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0)).toBe(true);
        await image.evaluate((element: HTMLImageElement) => element.decode());
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await info.attach(`clinic-from-${position === 0 ? 'hero' : 'footer'}-${width}.png`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
      const booking = page.locator('a[href="/b/skin-beauty/book"]:visible').last();
      await booking.scrollIntoViewIfNeeded();
      await booking.click();
      await expect(page).toHaveURL(`${BASE_URL}/b/skin-beauty/book`);
      await expect(page.getByText(t.booking.chooseServices, { exact: true })).toBeVisible();
    }
    expect(chooserVisits).toEqual([]);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
  });
}
