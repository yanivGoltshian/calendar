import { test, expect } from '@playwright/test';
import { STRINGS } from './strings';
import { serverReachable } from './helpers';

/**
 * Flow 7 — Customer (end-user) email sign-in via OTP: request UI.
 *
 * Verifies the /login screen exposes the email channel and its one-time-code
 * request form. We stop at "send code" (no real OTP round-trip) so the spec
 * needs only a reachable server, no DB seed.
 */
test.describe('Customer login (/login) — email OTP request UI', () => {
  test('email channel toggle reveals the email field and send-code button', async ({ page }) => {
    test.skip(!(await serverReachable()), 'app server not reachable — set E2E_BASE_URL');

    await page.goto('/login');

    const phoneToggle = page.getByRole('button', { name: STRINGS.auth.methodPhone });
    const emailToggle = page.getByRole('button', { name: STRINGS.auth.methodEmail });
    await expect(phoneToggle).toBeVisible();
    await expect(emailToggle).toBeVisible();

    await emailToggle.click();

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: STRINGS.auth.sendCode })).toBeVisible();
  });
});
