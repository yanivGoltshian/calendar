import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright';
import { requireIsolatedDatabase } from '../integration/fixtures';
import { VIEWPORTS } from '../e2e/visualFixtures';

requireIsolatedDatabase();
const root = process.cwd();
const candidate = process.env.E2E_BASE_URL!;
assert.equal(new URL(candidate).hostname, '127.0.0.1');
const evidence = resolve(process.env.TEST_RUNTIME_DIR!, 'comparison');
mkdirSync(evidence, { recursive: true });
const paths = [
  ['home', '/'],
  ['demo', '/b/demo-barbershop'],
  ['basic', '/b/visual-regression-basic'],
  ['clinic', '/b/skin-beauty'],
  ['published', '/b/visual-regression-published'],
  ['youtube', '/b/visual-regression-youtube'],
  ['vimeo', '/b/visual-regression-vimeo'],
] as const;
const revisions = [
  ['pre-audit', '0ea8d5d8240daa024e89f4b4df415499f32b7799'],
  ['deployed', '0db8ad6a73ef394381f49621e69570544a198e2c'],
] as const;
function run(command: string, args: string[], cwd: string, log?: string) {
  const fd = log ? openSync(log, 'w') : undefined;
  try {
    const result = spawnSync(command, args, {
      cwd,
      env: process.env,
      stdio: fd === undefined ? 'inherit' : ['ignore', fd, fd],
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${command} ${args.join(' ')} failed; ${log ?? ''}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function prepareDependencies(source: string, label: string) {
  const shared = join(root, 'node_modules');
  const local = join(source, 'node_modules');
  mkdirSync(local);
  for (const name of readdirSync(shared)) {
    if (name !== '@prisma' && name !== '.prisma') {
      symlinkSync(join(shared, name), join(local, name), 'dir');
    }
  }
  mkdirSync(join(local, '@prisma'));
  for (const name of readdirSync(join(shared, '@prisma'))) {
    if (name === 'client')
      cpSync(join(shared, '@prisma', name), join(local, '@prisma', name), {
        recursive: true,
      });
    else symlinkSync(join(shared, '@prisma', name), join(local, '@prisma', name), 'dir');
  }
  // Generate each historical schema's types without replacing the candidate client.
  run(
    process.execPath,
    [join(shared, 'prisma/build/index.js'), 'generate'],
    source,
    join(evidence, `${label}-prisma.log`),
  );
}
async function freePort() {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}
async function stop(app: ChildProcess) {
  if (app.exitCode !== null || app.signalCode !== null) return;
  app.kill('SIGTERM');
  await new Promise<void>((resolve) => app.once('exit', () => resolve()));
}

type Geometry = {
  page: string;
  width: number;
  overflow: boolean;
  hero: { x: number; y: number; width: number; height: number } | null;
  video: {
    x: number;
    y: number;
    width: number;
    height: number;
    fit: string;
    controls: boolean;
    muted: boolean;
    autoplay: boolean;
    loop: boolean;
    inline: boolean;
    playing: boolean;
    currentTime: number;
    decodedWidth: number;
  } | null;
  errors: string[];
  embed: { x: number; y: number; width: number; height: number; src: string } | null;
};
const measurements: Record<string, Geometry[]> = {};
const candidateFiles = [
  'src/components/publicLanding/DecorativeHeroMedia.tsx',
  'src/components/publicLanding/PremiumClinicHeader.tsx',
  'src/app/admin/onboarding/OnboardingWizard.tsx',
  'src/lib/videoEmbed.ts',
  'src/i18n/he.ts',
  'src/server/media/image.ts',
  'src/server/media/uploadHandler.ts',
  'src/lib/og/assets.ts',
  'package-lock.json',
];
const candidateHashes = Object.fromEntries(
  candidateFiles.map((path) => [
    path,
    createHash('sha256').update(readFileSync(path)).digest('hex'),
  ]),
);

async function capture(browser: Browser, label: string, origin: string) {
  const records: Geometry[] = [];
  mkdirSync(join(evidence, label), { recursive: true });
  for (const width of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
      locale: 'he-IL',
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort('blockedbyclient'),
    );
    await context.route(
      /https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//,
      (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<html style="background:#317575;color:white"><body>Synthetic provider frame</body></html>',
        }),
    );
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-09-07T09:00:00Z'));
      for (const [name, path] of paths) {
        const errors: string[] = [];
        const onError = (error: Error) => errors.push(error.message);
        page.on('pageerror', onError);
        assert((await page.goto(`${origin}${path}`, { waitUntil: 'load' }))?.ok());
        await page.locator('h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1000);
        // Trigger lazy sections identically on all source revisions.
        for (
          let y = 0;
          y < (await page.evaluate(() => document.body.scrollHeight));
          y += 700
        ) {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          await page.waitForTimeout(50);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(700);
        const geometry = await page.evaluate(
          ({ name, width }) => {
            const video = document.querySelector<HTMLVideoElement>('header video');
            const embed = document.querySelector<HTMLIFrameElement>('header iframe');
            const hero =
              video?.closest('section') ??
              embed?.closest('section') ??
              document.querySelector('main section');
            return {
              page: name,
              width,
              overflow: document.documentElement.scrollWidth > innerWidth,
              hero: hero ? hero.getBoundingClientRect().toJSON() : null,
              embed: embed
                ? { ...embed.getBoundingClientRect().toJSON(), src: embed.src }
                : null,
              video: video
                ? {
                    ...video.getBoundingClientRect().toJSON(),
                    fit: getComputedStyle(video).objectFit,
                    controls: video.controls,
                    muted: video.muted,
                    autoplay: video.autoplay,
                    loop: video.loop,
                    inline: video.playsInline,
                    playing: !video.paused && video.currentTime > 0,
                    currentTime: video.currentTime,
                    decodedWidth: video.videoWidth,
                  }
                : null,
            };
          },
          { name, width },
        );
        const videos = page.locator('video');
        for (const video of await videos.all())
          await video.evaluate(async (v: HTMLVideoElement) => {
            v.pause();
            if (v.readyState >= 2 && Number.isFinite(v.duration)) {
              const seek = Math.min(0.5, v.duration);
              if (Math.abs(v.currentTime - seek) > 0.01) {
                await new Promise<void>((resolve) => {
                  v.addEventListener('seeked', () => resolve(), { once: true });
                  v.currentTime = seek;
                });
              }
            }
          });
        await page.screenshot({
          path: join(evidence, label, `${name}-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        if (geometry.video || geometry.embed)
          await page.locator('header section').screenshot({
            path: join(evidence, label, `${name}-hero-${width}.png`),
            animations: 'disabled',
          });
        records.push({ ...geometry, errors });
        page.off('pageerror', onError);
      }
    } finally {
      await context.close();
    }
  }
  measurements[label] = records;
  writeFileSync(join(evidence, label, 'geometry.json'), JSON.stringify(records, null, 2));

  const samples = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      locale: 'he-IL',
      isMobile: true,
      hasTouch: true,
    });
    try {
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort('blockedbyclient'),
      );
      const page = await context.newPage();
      await page.addInitScript(() => {
        const samples: number[] = [];
        Object.defineProperty(window, '__lcpSamples', { value: samples });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => samples.push(e.startTime)),
        ).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 200_000,
        uploadThroughput: 200_000,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`${origin}/b/visual-regression-published`, { waitUntil: 'load' });
      await page.waitForTimeout(3000);
      samples.push(
        await page.evaluate(() => {
          const video = document.querySelector<HTMLVideoElement>('header video');
          const lcp: unknown = Reflect.get(window, '__lcpSamples');
          const resources = performance.getEntriesByType(
            'resource',
          ) as PerformanceResourceTiming[];
          return {
            lcpMs: Array.isArray(lcp) ? lcp.at(-1) : null,
            transferredBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
            videoTransferredBytes: resources
              .filter((r) => r.name.includes('hero-portrait.mp4'))
              .reduce((s, r) => s + r.transferSize, 0),
            videoPlaying: !!video && !video.paused && video.currentTime > 0,
            decodedVideoWidth: video?.videoWidth ?? 0,
          };
        }),
      );
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    join(evidence, label, 'performance.json'),
    JSON.stringify(
      {
        profile: {
          width: 390,
          height: 844,
          bytesPerSecond: 200_000,
          latencyMs: 150,
          cpuSlowdown: 4,
        },
        samples,
        scope:
          'Local production builds, identical synthetic seed and media, current locked runtime dependencies for all three source revisions.',
      },
      null,
      2,
    ),
  );
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [label, revision] of revisions) {
      const source = mkdtempSync(join(root, '.test-runtime', 'visual-source-'));
      let app: ChildProcess | undefined;
      try {
        const archive = join(evidence, `${label}.tar`);
        run('git', ['archive', '--format=tar', '-o', archive, revision], root);
        run('tar', ['-xf', archive, '-C', source], root);
        rmSync(archive);
        prepareDependencies(source, label);
        cpSync(
          join(root, 'public/images/visual-regression'),
          join(source, 'public/images/visual-regression'),
          { recursive: true },
        );
        run(
          process.execPath,
          [join(root, 'node_modules/next/dist/bin/next'), 'build'],
          source,
          join(evidence, `${label}-build.log`),
        );
        const port = await freePort();
        const origin = `http://127.0.0.1:${port}`;
        const fd = openSync(join(evidence, `${label}-app.log`), 'w');
        app = spawn(
          process.execPath,
          [
            join(root, 'node_modules/next/dist/bin/next'),
            'start',
            '-H',
            '127.0.0.1',
            '-p',
            String(port),
          ],
          {
            cwd: source,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: ['ignore', fd, fd],
          },
        );
        closeSync(fd);
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          assert.equal(app.exitCode, null, `${label} app exited`);
          try {
            if (
              (await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) })).ok
            ) {
              ready = true;
              break;
            }
          } catch (error) {
            if (!(
              error instanceof TypeError ||
              (error instanceof DOMException && error.name === 'TimeoutError')
            ))
              throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        assert(ready, `${label} app readiness`);
        await capture(browser, label, origin);
      } finally {
        if (app) await stop(app);
        rmSync(source, { recursive: true, force: true });
      }
    }
    await capture(browser, 'candidate', candidate);
    const comparisons = measurements.candidate
      .filter((r) => r.video)
      .map((after) => {
        const before = measurements['pre-audit'].find(
          (r) => r.page === after.page && r.width === after.width,
        )!;
        const deployed = measurements.deployed.find(
          (r) => r.page === after.page && r.width === after.width,
        )!;
        assert(
          before.hero && after.hero && before.video && after.video && deployed.video,
        );
        assert(
          Math.abs(before.hero.height - after.hero.height) < 1,
          `${after.page} ${after.width}: hero height changed`,
        );
        assert(
          Math.abs(before.video.width - after.video.width) < 1,
          `${after.page} ${after.width}: video width changed`,
        );
        for (const axis of ['x', 'y', 'height'] as const) {
          assert(
            Math.abs(before.video[axis] - after.video[axis]) < 1,
            `${after.page} ${after.width}: video ${axis} changed`,
          );
        }
        assert(
          after.video.playing && after.video.fit === 'cover' && !after.video.controls,
        );
        assert(
          before.video.playing && deployed.video.controls && !deployed.video.playing,
        );
        return {
          page: after.page,
          width: after.width,
          passed: true,
          beforeHeight: before.hero.height,
          deployedHeight: deployed.hero?.height,
          afterHeight: after.hero.height,
        };
      });
    const embedComparisons = measurements.candidate
      .filter((r) => r.embed)
      .map((after) => {
        const before = measurements['pre-audit'].find(
          (r) => r.page === after.page && r.width === after.width,
        )!;
        assert(before.embed && after.embed);
        for (const axis of ['x', 'y', 'width', 'height'] as const) {
          assert(
            Math.abs(before.embed[axis] - after.embed[axis]) < 1,
            `${after.page} ${after.width}: embed ${axis} changed`,
          );
        }
        assert.equal(new URL(after.embed.src).searchParams.get('autoplay'), '1');
        return {
          page: after.page,
          width: after.width,
          passed: true,
          provider: 'controlled local iframe response; external playback not tested',
        };
      });
    writeFileSync(
      join(evidence, 'result.json'),
      JSON.stringify(
        {
          revisions,
          comparisons,
          embedComparisons,
          candidateSource: 'working tree',
          candidateHashes,
          screenshots:
            'Deterministic synthetic video seek=0.5s; same browser clock, locale and viewport.',
        },
        null,
        2,
      ),
    );
    console.log(`Comparative evidence: ${evidence}`);
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
