import { createServer, type ServerResponse } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { visualFixture, HERO_VIDEO } from './visualFixtures';
import { cleanupFixture } from '../integration/fixtures';
import { prisma } from '../src/lib/db';
import { prepareHeroVideo } from '../src/server/media/video';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

test('prepared hero presents advancing decoded frames before the response completes', async ({
  page,
}, info) => {
  const directory = await mkdtemp(join(tmpdir(), 'video-progressive-'));
  let pending: ServerResponse | undefined;
  let responseEnded = false;
  const source = join(directory, 'source.mov');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-stream_loop',
    '4',
    '-i',
    'e2e/assets/hero-portrait.mp4',
    '-c',
    'copy',
    '-y',
    source,
  ]);
  const output = await prepareHeroVideo(await readFile(source));
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': output.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    response.write(output.subarray(0, Math.floor(output.length * 0.75)));
    pending = response;
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Synthetic media server unavailable');
  const videoUrl = `http://127.0.0.1:${address.port}/synthetic.mp4`;
  const f = await visualFixture({ video: videoUrl });
  try {
    await page.route(videoUrl, (route) => route.continue());
    await page.goto(`/b/${f.business.slug}`, { waitUntil: 'domcontentloaded' });
    const video = page.locator('header video');
    await expect(video).toHaveAttribute('src', videoUrl);
    const frames = await video.evaluate(async (v: HTMLVideoElement) => {
      const presented: { time: number; width: number; height: number }[] = [];
      await new Promise<void>((resolve) => {
        const frame: VideoFrameRequestCallback = (_now, metadata) => {
          presented.push({
            time: metadata.mediaTime,
            width: metadata.width,
            height: metadata.height,
          });
          if (presented.length === 3) resolve();
          else v.requestVideoFrameCallback(frame);
        };
        v.requestVideoFrameCallback(frame);
      });
      return presented;
    });
    expect(responseEnded).toBe(false);
    expect(pending?.writableEnded).toBe(false);
    expect(frames[2].time).toBeGreaterThan(frames[0].time);
    expect(frames.every((frame) => frame.width === 180 && frame.height === 320)).toBe(
      true,
    );
    await info.attach('progressive-frames.json', {
      body: JSON.stringify({
        bytes: output.length,
        fractionSent: 0.75,
        frames,
        responseEnded,
      }),
      contentType: 'application/json',
    });
    await info.attach('decoded-hero.png', {
      body: await video.screenshot(),
      contentType: 'image/png',
    });
    pending!.end(output.subarray(Math.floor(output.length * 0.75)));
    responseEnded = true;
  } finally {
    pending?.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupFixture(f);
    await rm(directory, { recursive: true, force: true });
  }
});

test('production editor keeps old media and blocks publication throughout preparation and failure', async ({
  page,
  context,
}) => {
  const f = await visualFixture();
  let finish: (() => void) | undefined;
  try {
    const token = await encode({
      token: { email: f.business.ownerEmail },
      secret: process.env.AUTH_SECRET!,
      salt: 'authjs.session-token',
    });
    await context.addCookies([
      { name: 'authjs.session-token', value: token, url: BASE_URL },
    ]);
    await page.goto('/admin/onboarding?edit=premium');
    await expect(page.locator('form.pw-phone')).toHaveAttribute(
      'data-upload-ready',
      'true',
    );
    await page.locator('.pw-pips button').nth(3).click();
    const input = page.locator('input[type=file][accept^="video/"]');
    await expect(input).toBeEnabled();
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route('**/api/upload/hero-video', async (route) => {
      await held;
      await route.fulfill({
        status: 422,
        json: { error: 'הסרטון חורג ממגבלת משאבי ההכנה.' },
      });
    });
    await input.setInputFiles('e2e/assets/hero-portrait.mp4');
    await expect(page.getByRole('status')).toHaveText(
      t.admin.onboarding.premium.steps.hero.uploadingVideo,
    );
    await expect(input).toBeDisabled();
    await expect(page.locator('.pw-next')).toBeDisabled();
    await expect(page.locator('.pw-vid .pw-hint')).toHaveText(HERO_VIDEO);
    const before = await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
      select: { landingContent: true },
    });
    expect((before.landingContent as { heroVideoUrl: string }).heroVideoUrl).toBe(
      HERO_VIDEO,
    );
    finish!();
    await expect(page.locator('.pw-vid .pw-err')).toHaveText(
      'הסרטון חורג ממגבלת משאבי ההכנה.',
    );
    await expect(input).toBeEnabled();
    await expect(page.locator('.pw-vid .pw-hint')).toHaveText(HERO_VIDEO);
    const after = await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
      select: { landingContent: true },
    });
    expect(after.landingContent).toEqual(before.landingContent);
  } finally {
    finish?.();
    await cleanupFixture(f);
  }
});
