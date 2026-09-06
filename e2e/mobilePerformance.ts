import type { Browser } from '@playwright/test';
import { BASE_URL } from './helpers';

export async function measureMobilePages(browser: Browser, paths: string[]) {
  const results: { path: string; lcpMs: number[] }[] = [];
  for (const path of paths) {
    const lcpMs: number[] = [];
    for (let repetition = 0; repetition < 3; repetition++) {
      const context = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        locale: 'he-IL',
      });
      try {
        await context.route('**/*', (route) =>
          new URL(route.request().url()).origin === new URL(BASE_URL).origin
            ? route.continue()
            : route.abort(),
        );
        const page = await context.newPage();
        await page.addInitScript(() => {
          const samples: number[] = [];
          Object.defineProperty(window, '__lcpSamples', { value: samples });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) samples.push(entry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
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
        const response = await page.goto(path, { waitUntil: 'load', timeout: 60_000 });
        if (!response?.ok()) throw new Error(`Mobile navigation failed: ${path}`);
        // Observe deferred above-fold replacements without user input ending the LCP window.
        await page.waitForTimeout(2_000);
        const lcp = await page.evaluate(() => {
          const samples: unknown = Reflect.get(window, '__lcpSamples');
          return Array.isArray(samples) && samples.length ? Number(samples.at(-1)) : 0;
        });
        if (!Number.isFinite(lcp) || lcp <= 0)
          throw new Error(`LCP was not observed: ${path}`);
        lcpMs.push(lcp);
      } finally {
        await context.close();
      }
    }
    results.push({ path, lcpMs });
  }
  return {
    profile: {
      width: 390,
      height: 844,
      downloadBytesPerSecond: 200_000,
      latencyMs: 150,
      cpuSlowdown: 4,
      repetitions: 3,
      coldBrowserCache: true,
    },
    scope:
      'Local standalone production build and synthetic fixtures; not live LCP or field data.',
    results: results.map((result) => ({
      ...result,
      medianMs: [...result.lcpMs].sort((a, b) => a - b)[1],
    })),
  };
}
