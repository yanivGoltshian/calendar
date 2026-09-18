import { createHmac, randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { createAppointment } from '../src/server/repos/appointments';
import { t } from '../src/i18n';
import type { BrowserContext } from '@playwright/test';

test.afterAll(() => prisma.$disconnect());

async function authenticate(context: BrowserContext, userId: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Synthetic session secret required');
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      name: 'Synthetic history customer',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  await context.addCookies([
    {
      name: 'client_session',
      value: `${payload}.${signature}`,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test('approved public history preserves upcoming, paginates private snapshots and removes both headings', async ({
  context,
  page,
}, info) => {
  test.setTimeout(120000);
  const f = await bookingFixture();
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.invalid`,
      name: 'Synthetic history customer',
    },
  });
  const r = t.premiumLanding.clinic.returning;
  try {
    await prisma.client.update({
      where: { id: f.client.id },
      data: { userId: user.id, identityVerifiedAt: new Date() },
    });
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        publicPageStyle: 'LANDING',
        landingContent: {
          presentation: 'premium',
          heroHeadline: 'Existing business heading',
          heroSubtext: 'Existing business content',
          sections: { location: false },
        },
      },
    });
    await prisma.businessSettings.update({
      where: { businessId: f.business.id },
      data: { notifyOnCancellation: false },
    });
    await createAppointment(f.input);
    for (let i = 0; i < 21; i++) {
      await prisma.appointment.create({
        data: {
          businessId: f.business.id,
          staffId: f.staff.id,
          clientId: f.client.id,
          startAt: new Date(Date.now() - (i + 2) * 86400000),
          endAt: new Date(Date.now() - (i + 2) * 86400000 + 1800000),
          status: 'DONE',
          totalPriceAgorot: 25000,
          services: {
            create: {
              serviceId: f.service.id,
              nameSnapshot: `Historical service ${i}`,
              durationMinSnapshot: 30,
              priceAgorotSnapshot: 25000,
            },
          },
        },
      });
    }
    await authenticate(context, user.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/b/${f.business.slug}`);
    const section = page.locator('#lp-hello');
    await expect(section.getByRole('tab', { name: r.upcomingTab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      section.getByRole('heading', { name: 'שלום Synthetic history customer' }),
    ).toBeVisible();
    await expect(section.getByText(r.subtitle, { exact: true })).toBeVisible();
    await expect(section.getByRole('link', { name: r.addToCalendarAria })).toBeVisible();
    await page.route('**/history', (route) =>
      route.fulfill({ status: 500, json: { error: 'synthetic_failure' } }),
    );
    await section.getByRole('tab', { name: r.historyTab }).click();
    await expect(section.getByRole('alert')).toContainText(r.historyError);
    await section.getByRole('tab', { name: r.upcomingTab }).click();
    await expect(section.getByRole('link', { name: r.addToCalendarAria })).toBeVisible();
    await page.unroute('**/history');
    await section.getByRole('tab', { name: r.historyTab }).click();
    await section.getByRole('button', { name: r.retry }).click();
    await expect(section.locator('[data-history-card]')).toHaveCount(20);
    await expect(section.locator('[data-history-card]').first()).toContainText('250');
    await expect(section.locator('[data-history-card]').first()).toContainText(
      r.paymentUnrecorded,
    );
    await section.getByRole('button', { name: r.loadMore }).click();
    await expect(section.locator('[data-history-card]')).toHaveCount(21);
    await expect(section.getByRole('button', { name: r.loadMore })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await info.attach('history-mobile.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.setViewportSize({ width: 1366, height: 940 });
    await expect(
      page.getByRole('heading', { name: 'Existing business heading', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-palette-surface="sticky-booking"]')).toBeVisible();
    await section.getByRole('tab', { name: r.historyTab }).press('Home');
    await expect(section.getByRole('tab', { name: r.upcomingTab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await section.getByRole('button', { name: t.account.cancelCta, exact: true }).click();
    await section.getByRole('button', { name: t.account.cancelKeep }).click();
    await expect(section.getByRole('link', { name: r.addToCalendarAria })).toBeVisible();
  } finally {
    await cleanupFixture(f);
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('history-only customers see empty, missing-price, paid and expired-session states', async ({
  context,
  page,
}, info) => {
  const f = await bookingFixture();
  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  const r = t.premiumLanding.clinic.returning;
  try {
    await prisma.client.update({
      where: { id: f.client.id },
      data: { userId: user.id, identityVerifiedAt: new Date() },
    });
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        publicPageStyle: 'LANDING',
        landingContent: {
          presentation: 'premium',
          heroHeadline: 'Existing business heading',
        },
      },
    });
    await authenticate(context, user.id);
    await page.goto(`/b/${f.business.slug}`);
    await expect(page.locator('#lp-hello')).toHaveCount(0);
    const section = page.locator('#lp-hello');
    await expect(page.getByText(r.historyEmpty, { exact: true })).toHaveCount(0);
    await expect(page.getByText(r.empty, { exact: true })).toHaveCount(0);
    for (let i = 0; i < 2; i++) {
      const appointment = await prisma.appointment.create({
        data: {
          businessId: f.business.id,
          staffId: f.staff.id,
          clientId: f.client.id,
          startAt: new Date(Date.now() - (i + 2) * 86400000),
          endAt: new Date(Date.now() - (i + 2) * 86400000 + 1800000),
          status: 'DONE',
          totalPriceAgorot: i === 0 ? 25000 : 0,
          services: {
            create: {
              serviceId: f.service.id,
              nameSnapshot:
                i === 0 ? 'Paid historical service' : 'Legacy historical service',
              durationMinSnapshot: 30,
              priceAgorotSnapshot: i === 0 ? 25000 : 0,
            },
          },
        },
      });
      if (i === 0)
        await prisma.sale.create({
          data: {
            businessId: f.business.id,
            clientId: f.client.id,
            appointmentId: appointment.id,
            status: 'COMPLETED',
            subtotalAgorot: 25000,
            discountAgorot: 3000,
            totalAgorot: 22000,
            paidAgorot: 22000,
            items: {
              create: {
                kind: 'SERVICE',
                serviceId: f.service.id,
                nameSnapshot: 'Paid service',
                quantity: 1,
                unitPriceAgorot: 25000,
                lineTotalAgorot: 25000,
              },
            },
            payments: { create: { amountAgorot: 22000 } },
          },
        });
    }
    await page.reload();
    await expect(section.getByRole('tab', { name: r.historyTab })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(section.getByRole('tab', { name: r.upcomingTab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(section.getByText(r.empty, { exact: true })).toBeVisible();
    await section.getByRole('tab', { name: r.historyTab }).click();
    await expect(section.locator('[data-history-card]')).toHaveCount(2);
    const paid = section
      .locator('[data-history-card]')
      .filter({ hasText: 'Paid historical service' });
    await expect(paid).toContainText(r.paidAmount);
    await expect(paid).toContainText('220');
    await expect(paid).toContainText('250');
    await expect(section.locator('[data-history-card]').last()).toContainText(
      r.missingPrice,
    );
    await info.attach('history-desktop-paid.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.route('**/history', (route) =>
      route.fulfill({ status: 401, json: { error: 'unauthorized' } }),
    );
    await page.reload();
    await section.getByRole('tab', { name: r.historyTab }).click();
    await expect(section.getByRole('alert')).toContainText(r.sessionExpired);
    await expect(section.locator('[data-history-card]')).toHaveCount(0);
    await expect(section.getByRole('link', { name: r.signIn })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/b/${f.business.slug}`)}`,
    );
  } finally {
    await cleanupFixture(f);
    await prisma.user.delete({ where: { id: user.id } });
  }
});
