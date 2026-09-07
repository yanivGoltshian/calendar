import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { cleanupFixture } from '../integration/fixtures';
import { HERO_VIDEO, VIEWPORTS, visualFixture } from './visualFixtures';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of VIEWPORTS) {
  test(`decorative public hero at ${width}px preserves crop, playback and booking access`, async ({
    browser,
  }, info) => {
    const f = await visualFixture();
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: 'he-IL',
      isMobile: width < 768,
      hasTouch: width < 768,
      deviceScaleFactor: 1,
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === process.env.E2E_BASE_URL
        ? route.continue()
        : route.abort('blockedbyclient'),
    );
    const page = await context.newPage();
    try {
      await page.goto(`${process.env.E2E_BASE_URL}/b/${f.business.slug}`);
      const hero = page.locator('header section').first();
      const video = hero.locator('video');
      await expect
        .poll(() =>
          video.evaluate(
            (v: HTMLVideoElement) =>
              !v.paused &&
              v.currentTime > 0.1 &&
              v.videoWidth === 180 &&
              v.videoHeight === 320,
          ),
        )
        .toBe(true);
      const geometry = await video.evaluate((v: HTMLVideoElement) => {
        const r = v.getBoundingClientRect();
        const h = v.closest('section')!.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
          hero: { width: h.width, height: h.height, x: h.x, y: h.y },
          fit: getComputedStyle(v).objectFit,
          controls: v.controls,
          muted: v.muted,
          loop: v.loop,
          inline: v.playsInline,
        };
      });
      expect(geometry.fit).toBe('cover');
      expect(geometry.controls).toBe(false);
      expect(geometry.muted && geometry.loop && geometry.inline).toBe(true);
      expect(geometry.x).toBeCloseTo(0, 0);
      expect(geometry.width / geometry.hero.width).toBeCloseTo(
        width < 640 ? 0.46 : 0.34,
        2,
      );
      expect(geometry.height).toBeCloseTo(geometry.hero.height, 0);
      expect(geometry.y).toBeCloseTo(geometry.hero.y, 0);
      await video.evaluate((v: HTMLVideoElement) => {
        v.currentTime = 1;
        v.playbackRate = 0.5;
      });
      await page.getByRole('button', { name: t.premiumLanding.heroMedia.pause }).click();
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
        .toBe(true);
      const paused = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(paused).toBeGreaterThanOrEqual(1);
      await expect(video).toHaveAttribute('src', HERO_VIDEO);
      const pausedFrame = await video.screenshot();
      await page.waitForTimeout(300);
      expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(paused);
      expect(await video.screenshot()).toEqual(pausedFrame);
      await page.getByRole('button', { name: t.premiumLanding.heroMedia.play }).click();
      await expect
        .poll(() =>
          video.evaluate((v: HTMLVideoElement) => (v.paused ? 0 : v.currentTime)),
        )
        .toBeGreaterThan(paused);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
        .toBe(true);
      await expect(video).toHaveAttribute('src', HERO_VIDEO);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused))
        .toBe(true);
      // Freeze the same decoded frame only after proving real playback.
      await video.evaluate(async (v: HTMLVideoElement) => {
        v.pause();
        v.currentTime = 0.5;
        await new Promise<void>((resolve) =>
          v.addEventListener('seeked', () => resolve(), { once: true }),
        );
      });
      await info.attach(`hero-${width}.png`, {
        body: await hero.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await info.attach(`geometry-${width}.json`, {
        body: JSON.stringify(geometry),
        contentType: 'application/json',
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      const cta = hero.locator(`a[href="/b/${f.business.slug}/book"]`);
      await cta.click();
      await expect(page).toHaveURL(/\/book$/);
      await expect(
        page.getByText(t.booking.chooseServices, { exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
      await cleanupFixture(f);
    }
  });
}

for (const fallback of [
  'reduced-motion',
  'save-data',
  'autoplay-denied',
  'broken-video',
] as const) {
  test(`hero ${fallback} keeps poster, dimensions and manual fallback`, async ({
    page,
  }, info) => {
    const f = await visualFixture();
    const videoRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes(HERO_VIDEO)) videoRequests.push(r.url());
    });
    try {
      if (fallback === 'reduced-motion')
        await page.emulateMedia({ reducedMotion: 'reduce' });
      if (fallback === 'save-data')
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', {
            value: Object.assign(new EventTarget(), { saveData: true }),
          });
        });
      if (fallback === 'autoplay-denied')
        await page.addInitScript(() => {
          const play = HTMLMediaElement.prototype.play;
          let denied = true;
          HTMLMediaElement.prototype.play = function () {
            if (denied)
              return Promise.reject(
                new DOMException('Synthetic autoplay denial', 'NotAllowedError'),
              );
            return play.call(this);
          };
          document.addEventListener(
            'click',
            () => {
              denied = false;
            },
            true,
          );
        });
      if (fallback === 'broken-video')
        await page.route(`**${HERO_VIDEO}`, (route) => route.fulfill({ status: 404 }));
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('[data-hero-media] img')).toBeVisible();
      await expect(
        page.getByRole('button', { name: t.premiumLanding.heroMedia.play }),
      ).toBeVisible();
      expect(
        await page
          .locator('header video')
          .evaluate((v: HTMLVideoElement) => v.paused && !v.controls),
      ).toBe(true);
      if (fallback === 'reduced-motion' || fallback === 'save-data')
        expect(videoRequests).toEqual([]);
      if (fallback === 'broken-video') {
        await expect(page.getByRole('status')).toHaveText(
          t.premiumLanding.heroMedia.unavailable,
        );
      } else {
        await page.getByRole('button', { name: t.premiumLanding.heroMedia.play }).click();
        await expect
          .poll(() =>
            page
              .locator('header video')
              .evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0.1),
          )
          .toBe(true);
      }
      await info.attach(`${fallback}.png`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await page.locator('header section a[href$="/book"]').click();
      await expect(page).toHaveURL(/\/book$/);
    } finally {
      await cleanupFixture(f);
    }
  });
}

for (const provider of ['youtube', 'vimeo'] as const) {
  test(`${provider} decorative embed uses isolated provider stub and defers under reduced motion`, async ({
    page,
  }, info) => {
    const f = await visualFixture({
      video:
        provider === 'youtube'
          ? 'https://youtu.be/abcdefghijk'
          : 'https://vimeo.com/123456789',
    });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route(
        provider === 'youtube'
          ? 'https://www.youtube-nocookie.com/**'
          : 'https://player.vimeo.com/**',
        (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<html><body style="margin:0;background:#317575">Synthetic provider</body></html>',
          }),
      );
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('header iframe')).toHaveCount(0);
      await page.getByRole('button', { name: t.premiumLanding.heroMedia.play }).click();
      const frame = page.locator('header iframe');
      await expect(frame).toBeVisible();
      await expect(frame).toHaveAttribute('src', /autoplay=1/);
      await expect(frame).toHaveAttribute('src', /mute(?:d)?=1/);
      await expect(frame).toHaveAttribute('src', /loop=1/);
      await expect(frame).toHaveAttribute('allow', /autoplay/);
      expect(await frame.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
        'none',
      );
      await expect(page.frameLocator('header iframe').locator('body')).toHaveText(
        'Synthetic provider',
      );
      await info.attach(`${provider}.png`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await page.getByRole('button', { name: t.premiumLanding.heroMedia.pause }).click();
      await expect(frame).toHaveCount(0);
    } finally {
      await cleanupFixture(f);
    }
  });
}
