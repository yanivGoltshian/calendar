import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { serializeSession } from '../src/lib/session';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of [1366, 390]) {
  test(`review dialog preserves business page, focus and scroll; submission stays private at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = await bookingFixture();
    const customer = await prisma.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    const text = `Synthetic pending review ${randomUUID()}`;
    let eligibilityRequests = 0;
    try {
      await prisma.businessSettings.update({
        where: { businessId: fixture.business.id },
        data: { pushEnabled: false },
      });
      await prisma.client.update({
        where: { id: fixture.client.id },
        data: {
          userId: customer.id,
          identityVerifiedAt: new Date(),
          name: 'Private synthetic reviewer',
        },
      });
      const appointment = await prisma.appointment.create({
        data: {
          businessId: fixture.business.id,
          clientId: fixture.client.id,
          staffId: fixture.staff.id,
          status: 'DONE',
          startAt: new Date(Date.now() - 86_400_000),
          endAt: new Date(Date.now() - 85_000_000),
          services: {
            create: {
              serviceId: fixture.service.id,
              nameSnapshot: 'Private synthetic treatment',
              durationMinSnapshot: 30,
              priceAgorotSnapshot: 5000,
            },
          },
        },
      });
      await context.addCookies([
        {
          name: 'client_session',
          value: serializeSession({
            userId: customer.id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
          url: BASE_URL,
        },
      ]);
      const eligibilityPath = `/api/public/b/${fixture.business.slug}/reviews/eligibility`;
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === eligibilityPath) eligibilityRequests++;
      });
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`/b/${fixture.business.slug}`);
      const initialHtml = await response!.text();
      for (const privateValue of [
        customer.id,
        appointment.id,
        'Private synthetic reviewer',
        'Private synthetic treatment',
      ]) {
        expect(initialHtml).not.toContain(privateValue);
      }
      const trigger = page.locator('[data-review-dialog-trigger]');
      await expect(trigger).toHaveAttribute('data-hydrated', 'true');
      expect(eligibilityRequests).toBe(0);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      const before = await page.evaluate(() => ({
        scrollY,
        bodyStyle: document.body.getAttribute('style'),
        title: document.querySelector('h1')?.textContent,
        timeOrigin: performance.timeOrigin,
      }));
      expect(before.scrollY).toBeGreaterThan(0);
      const pageUrl = page.url();
      const eligibilityResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === eligibilityPath,
      );
      await trigger.click();
      const loaded = await eligibilityResponse;
      expect(loaded.headers()['cache-control']).toBe('private, no-store');
      expect(loaded.headers().vary).toContain('Cookie');
      const dialog = page.getByRole('dialog', { name: t.reviews.customerTitle });
      await expect(dialog).toBeVisible();
      const form = dialog.locator('form');
      await expect(form).toHaveAttribute('data-hydrated', 'true');
      await expect(form.locator('select[name=appointmentId]')).toHaveValue(
        appointment.id,
      );
      expect(page.url()).toBe(pageUrl);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(before.timeOrigin);
      expect(await page.locator('h1').textContent()).toBe(before.title);
      expect(
        await dialog.evaluate(
          (element) =>
            element.matches(':modal') && element.contains(document.activeElement),
        ),
      ).toBe(true);
      await dialog.getByRole('button', { name: t.common.close, exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      expect(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.getAttribute('style'))).toBe(
        before.bodyStyle ?? '',
      );
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeCloseTo(before.scrollY, 0);
      await trigger.click();
      await expect(dialog.locator('form')).toHaveAttribute('data-hydrated', 'true');
      await dialog.getByRole('button', { name: t.common.close, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog.locator('form')).toHaveAttribute('data-hydrated', 'true');
      await dialog.locator('form button[type=submit]').click();
      expect(
        await prisma.businessReview.count({ where: { businessId: fixture.business.id } }),
      ).toBe(0);
      const rating = dialog.getByRole('radio', {
        name: t.reviews.starOption.replace('{rating}', '5'),
        exact: true,
      });
      await dialog
        .locator('label')
        .filter({
          has: page.getByRole('radio', {
            name: t.reviews.starOption.replace('{rating}', '5'),
            exact: true,
          }),
        })
        .click();
      await expect(rating).toBeChecked();
      await dialog.locator('textarea[name=text]').fill(width === 390 ? '' : text);
      await dialog.locator('form button[type=submit]').click();
      await expect(
        dialog.getByText(t.reviews.pendingSuccess, { exact: true }),
      ).toBeVisible();
      expect(page.url()).toBe(pageUrl);
      const stored = await prisma.businessReview.findUniqueOrThrow({
        where: { appointmentId: appointment.id },
      });
      expect(stored.status).toBe('PENDING');
      expect(stored.authorUserId).toBe(customer.id);
      expect(stored.rating).toBe(5);
      expect(stored.text).toBe(width === 390 ? '' : text);
      await dialog.getByRole('button', { name: t.reviews.back, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeCloseTo(before.scrollY, 0);
      await expect(page.locator('#reviews')).not.toContainText(text);
      const publicResponse = await context.request.get(`/b/${fixture.business.slug}`);
      const publicHtml = await publicResponse.text();
      for (const privateValue of [
        text,
        customer.id,
        appointment.id,
        stored.id,
        'Private synthetic reviewer',
      ]) {
        expect(publicHtml).not.toContain(privateValue);
      }
      await trigger.click();
      await expect(
        dialog.getByText(t.reviews.pendingSuccess, { exact: true }),
      ).toBeVisible();
      await expect(dialog.locator('form')).toHaveCount(0);
      await dialog
        .locator(':scope > div[aria-hidden=true]')
        .click({ position: { x: 5, y: 5 } });
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(eligibilityRequests).toBe(4);
    } finally {
      await cleanupFixture(fixture);
      await prisma.user.delete({ where: { id: customer.id } });
    }
  });
}

test('review dialog handles guest login, explicit loading failure and direct route fallback', async ({
  page,
}) => {
  const fixture = await bookingFixture();
  try {
    await page.goto(`/b/${fixture.business.slug}`);
    const trigger = page.locator('[data-review-dialog-trigger]');
    await expect(trigger).toHaveAttribute('data-hydrated', 'true');
    await page.route('**/reviews/eligibility', (route) => route.abort('failed'), {
      times: 1,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: t.reviews.customerTitle });
    await expect(dialog.getByRole('alert')).toHaveText(t.reviews.loadError);
    await dialog.getByRole('button', { name: t.reviews.retry }).click();
    await expect(
      dialog.getByRole('heading', { name: t.reviews.loginTitle }),
    ).toBeVisible();
    await expect(dialog.locator('form')).toHaveCount(0);
    await dialog.getByRole('button', { name: t.common.close, exact: true }).click();
    await expect(trigger).toBeFocused();
    const href = await trigger.getAttribute('href');
    await page.goto(href!);
    await expect(page.getByRole('heading', { name: t.reviews.loginTitle })).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
  }
});
