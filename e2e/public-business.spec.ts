import { test, expect } from '@playwright/test';
import { serverReachable, BUSINESS_SLUG } from './helpers';

/**
 * Public business page (/b/[slug]).
 *
 * DB-backed: the page 404s for an unknown slug, so it only runs when a seeded
 * business slug is supplied via E2E_BUSINESS_SLUG. Asserts the booking CTA
 * links into the stepper.
 */
test.describe('Public business page (/b/[slug])', () => {
  test('renders a booking CTA linking to the booking stepper', async ({ page }) => {
    test.skip(!(await serverReachable()), 'app server not reachable — set E2E_BASE_URL');
    test.skip(!BUSINESS_SLUG, 'no seeded business — set E2E_BUSINESS_SLUG');

    await page.goto(`/b/${BUSINESS_SLUG}`);

    const bookLink = page.locator(`a[href="/b/${BUSINESS_SLUG}/book"]`);
    await expect(bookLink.first()).toBeVisible();
  });
});
