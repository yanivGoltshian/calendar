import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for תור צ׳יק / Torchick.
 *
 * Green-by-default: there is intentionally NO `webServer` block, so the suite
 * never tries to boot the Next.js app (which needs a Postgres DB). Every spec
 * pings `baseURL` first and `test.skip()`s itself when the server is
 * unreachable. To actually exercise the flows, start the app yourself and set
 * `E2E_BASE_URL` (and `E2E_BUSINESS_SLUG` for the booking specs). See
 * `e2e/README.md`.
 *
 * `baseURL` is read from `process.env.E2E_BASE_URL` and falls back to a local
 * dev server. The production/Azure URL is deliberately NOT hardcoded here.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    locale: 'he-IL',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
