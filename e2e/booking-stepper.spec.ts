import { test, expect } from '@playwright/test';
import { STRINGS } from './strings';
import { serverReachable, BUSINESS_SLUG } from './helpers';

/**
 * Flow 8 (partial) — Public booking stepper navigation & validation.
 *
 * DB-backed (needs a seeded business with at least one service and staff
 * member), so it is gated behind E2E_BUSINESS_SLUG. It does NOT submit a
 * booking — it only proves the step gating: "next" is disabled until a service
 * is chosen, then the stepper advances to the staff step.
 */
test.describe('Booking stepper (/b/[slug]/book) — navigation & validation', () => {
  test('step 0 gates "next" until a service is picked, then advances to staff', async ({ page }) => {
    test.skip(!(await serverReachable()), 'app server not reachable — set E2E_BASE_URL');
    test.skip(!BUSINESS_SLUG, 'no seeded business — set E2E_BUSINESS_SLUG');

    await page.goto(`/b/${BUSINESS_SLUG}/book`);

    // Step indicator "1/6" and the services step header.
    await expect(page.getByText('1/6')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: STRINGS.booking.steps.services }),
    ).toBeVisible();

    const next = page.getByRole('button', { name: STRINGS.common.next });
    await expect(next).toBeDisabled();

    // Pick the first service (first button visually below the intro line).
    await page.locator(`button:below(:text("${STRINGS.booking.chooseServices}"))`).first().click();

    await expect(next).toBeEnabled();
    await next.click();

    await expect(
      page.getByRole('heading', { name: STRINGS.booking.steps.staff }),
    ).toBeVisible();
  });
});
