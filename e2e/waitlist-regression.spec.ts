import { test, expect } from './fixtures';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { prisma } from '../src/lib/db';
import { formatDateString } from '../src/lib/time';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

test('guest waitlist validates details, survives transport failure and saves one tenant-scoped request', async ({
  page,
}, info) => {
  const f = await bookingFixture();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/b/${f.business.slug}/book`);
    await page.getByRole('button', { name: new RegExp(f.service.name) }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    // A single eligible staff member is selected automatically.
    await expect(page.locator('input[type=date]')).toBeVisible();
    await page
      .locator('input[type=date]')
      .fill(formatDateString(f.startAt, f.business.timezone));
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page
      .getByRole('button', { name: t.booking.waitlist.partialCta, exact: true })
      .click();
    await page
      .getByRole('button', { name: t.booking.waitlist.submit, exact: true })
      .click();
    await expect(
      page.getByText(t.booking.waitlist.errorMissing, { exact: true }),
    ).toBeVisible();
    await page.locator('input[type=text]').fill('לקוח בדיקה');
    await page.locator('input[type=tel]').fill('0509876001');
    await page.locator('input[type=email]').fill('invalid');
    await page
      .getByRole('button', { name: t.booking.waitlist.submit, exact: true })
      .click();
    await expect(
      page.getByText(t.booking.waitlist.errorEmail, { exact: true }),
    ).toBeVisible();
    await page.locator('input[type=email]').fill('synthetic-waitlist@example.invalid');
    let attempts = 0;
    await page.route('**/api/waitlist/join', (route) =>
      ++attempts === 1 ? route.abort('failed') : route.continue(),
    );
    await page
      .getByRole('button', { name: t.booking.waitlist.submit, exact: true })
      .click();
    await expect(
      page.getByText(t.booking.waitlist.errorGeneric, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: t.booking.waitlist.submit, exact: true })
      .click();
    await expect(
      page.getByText(t.booking.waitlist.successTitle, { exact: true }),
    ).toBeVisible();
    expect(
      await prisma.waitlistEntry.count({
        where: { businessId: f.business.id, serviceId: f.service.id },
      }),
    ).toBe(1);
    await info.attach('waitlist-success.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await cleanupFixture(f);
  }
});
