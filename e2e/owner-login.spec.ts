import { test, expect } from '@playwright/test';
import { STRINGS } from './strings';
import { serverReachable } from './helpers';

/**
 * Flow 1 — Owner email sign-in screen.
 *
 * The heading and the "go to customer login" link render unconditionally. The
 * email OTP form itself is env-gated (NextAuth provider status), so we assert it
 * only when the email input is actually present. Needs a reachable server, no DB.
 */
test.describe('Owner login (/business/login)', () => {
  test('shows heading + customer-login link; email OTP form when the provider is enabled', async ({
    page,
  }) => {
    test.skip(!(await serverReachable()), 'app server not reachable — set E2E_BASE_URL');

    await page.goto('/business/login');

    await expect(page.getByRole('heading', { name: STRINGS.ownerLogin.title })).toBeVisible();

    const clientLink = page.getByRole('link', { name: STRINGS.ownerLogin.clientCta });
    await expect(clientLink).toBeVisible();
    await expect(clientLink).toHaveAttribute('href', '/login');

    // Email sign-in is gated by AUTH provider env; only assert it when rendered.
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count()) {
      await expect(emailInput.first()).toBeVisible();
      await expect(
        page.getByRole('button', { name: STRINGS.ownerLogin.emailSubmit }),
      ).toBeVisible();
    }
  });
});
