import { test, expect, type Page } from '@playwright/test';
import { STRINGS } from './strings';
import { serverReachable, BUSINESS_SLUG, ALLOW_BOOKING } from './helpers';

/**
 * Flow 8 (full) + Flow 9 — Public booking happy path ending in a real
 * appointment, booked as a guest (no OTP needed for guest booking).
 *
 * This WRITES to the database, so it is triple-gated and skipped by default:
 *   - E2E_BASE_URL      → a reachable, seeded server
 *   - E2E_BUSINESS_SLUG → a business with a service, a bookable staff member,
 *                         and working hours
 *   - E2E_ALLOW_BOOKING=1 → explicit opt-in to mutate data
 *
 * See e2e/README.md for how to stand up a disposable environment.
 */

/** yyyy-mm-dd for today+offset in local time (matches the app's date input). */
function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TIME_RE = /^\d{1,2}:\d{2}$/;

/** On the time step, scan forward day-by-day until a slot appears; pick it. */
async function pickFirstAvailableSlot(page: Page): Promise<boolean> {
  const dateInput = page.locator('input[type="date"]');
  for (let offset = 1; offset <= 21; offset++) {
    await dateInput.fill(localDateString(offset));
    // Wait for the slot grid or the "no slots" message to settle.
    await page.waitForLoadState('networkidle').catch(() => {});
    const slots = page.getByRole('button', { name: TIME_RE });
    if ((await slots.count()) > 0) {
      await slots.first().click();
      return true;
    }
  }
  return false;
}

test.describe('Booking happy path (guest) — confirmed appointment', () => {
  test('books an appointment through all six steps', async ({ page }) => {
    test.skip(!(await serverReachable()), 'app server not reachable — set E2E_BASE_URL');
    test.skip(!BUSINESS_SLUG, 'no seeded business — set E2E_BUSINESS_SLUG');
    test.skip(!ALLOW_BOOKING, 'booking mutates data — set E2E_ALLOW_BOOKING=1 to run');

    await page.goto(`/b/${BUSINESS_SLUG}/book`);
    const next = page.getByRole('button', { name: STRINGS.common.next });

    // Step 0 — service
    await page
      .locator(`button:below(:text("${STRINGS.booking.chooseServices}"))`)
      .first()
      .click();
    await next.click();

    // Step 1 — staff
    await page
      .locator(`button:below(:text("${STRINGS.booking.chooseStaff}"))`)
      .first()
      .click();
    await next.click();

    // Step 2 — date (seed a first date, then advance to the time step)
    await page.locator('input[type="date"]').fill(localDateString(1));
    await next.click();

    // Step 3 — time (scan for the first day with availability)
    const gotSlot = await pickFirstAvailableSlot(page);
    expect(gotSlot, 'expected at least one bookable slot within 21 days').toBeTruthy();
    await next.click();

    // Step 4 — summary → continue to confirm
    await page.getByRole('button', { name: STRINGS.booking.continueToConfirm }).click();

    // Step 5 — guest details + confirm
    await page.locator('input[type="text"]').first().fill('בדיקה אוטומטית');
    await page.getByRole('button', { name: STRINGS.booking.guestEmail }).click();
    await page.locator('input[type="email"]').first().fill('e2e-guest@example.com');
    await page.getByRole('button', { name: STRINGS.booking.confirmBooking }).click();

    // Confirmed (approval off) or pending (approval on) — either is a success.
    const success = page.getByText(STRINGS.booking.successTitle);
    const pending = page.getByText(STRINGS.booking.pendingTitle);
    await expect(success.or(pending)).toBeVisible({ timeout: 15_000 });
  });
});
