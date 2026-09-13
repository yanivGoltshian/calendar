import { randomUUID } from 'node:crypto';
import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { computeTrialHashes } from '../src/server/repos/trialLedger';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

test('superadmin imports one business and lands on its review screen', async ({
  page,
  context,
}) => {
  const email = `imported-${randomUUID()}@example.invalid`;
  const adminEmail = process.env.PLATFORM_ADMIN_EMAILS ?? 'yanivgolt@gmail.com';
  const token = await encode({
    token: { email: adminEmail },
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token',
  });
  await context.addCookies([
    { name: 'authjs.session-token', value: token, url: BASE_URL },
  ]);

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goto('/superadmin');
      await page
        .getByRole('button', { name: t.billing.superadmin.create.title, exact: true })
        .click();
      const form = page.locator('#new-customer-form');
      await form
        .getByLabel(t.billing.superadmin.create.email, { exact: true })
        .fill(email);
      await form
        .locator('input[name=importUrl]')
        .fill('https://8.8.8.8/business-import-fixture');
      await form
        .getByRole('button', { name: t.billing.superadmin.create.submit, exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/import-review/);
      await expect(
        page.getByRole('heading', { name: 'קליניקת אור', exact: true }),
      ).toBeVisible();
    }

    const businesses = await prisma.business.findMany({
      where: { ownerEmail: email },
      include: {
        services: true,
        workingHours: { where: { scope: 'BUSINESS' } },
      },
    });
    expect(businesses).toHaveLength(1);
    expect(businesses[0]?.listed).toBe(false);
    expect(businesses[0]?.businessImportedAt).not.toBeNull();
    expect(businesses[0]?.publicPageStyle).toBe('LANDING');
    expect(businesses[0]?.services.map(({ name }) => name).sort()).toEqual([
      'אבחון עור',
      'טיפול פנים',
    ]);
    expect(businesses[0]?.workingHours).toHaveLength(6);
    await expect(page.getByText('נושאים שדורשים בדיקה')).toBeVisible();
    await expect(page.getByText('מקורות ורמת ביטחון')).toBeVisible();
    await expect(page.getByText('מידע שחסר להשלמת ההקמה')).toBeVisible();

    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/b/${businesses[0]!.slug}`);
      await expect(
        page.getByRole('heading', { name: 'קליניקת אור', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('קליניקה לטיפולי עור ואסתטיקה.', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: t.publicPage.servicesTitle, exact: true }),
      ).toBeVisible();
      await expect(page.getByText('טיפול פנים', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('הרצל 10, תל אביב, תל אביב, 61000, IL')).toBeVisible();
      await expect(
        page.locator('a[href="mailto:hello@example.com"]').first(),
      ).toBeVisible();
      await expect(page.locator('a[href="https://example.com/"]').first()).toBeVisible();
      const teamSection = page
        .getByRole('heading', { name: t.publicPage.teamTitle, exact: true })
        .locator('..');
      await expect(teamSection.getByText('דנה לוי', { exact: true })).toBeVisible();
      await expect(
        teamSection.getByText('קליניקת אור', { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText('צוות מנוסה', { exact: true })).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
  } finally {
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.trialLedger.deleteMany({
      where: { emailHash: computeTrialHashes(email, null).emailHash },
    });
  }
});

test('non-admin cannot open the provisioning screen', async ({ page }) => {
  await page.goto('/superadmin');
  await expect(
    page.getByRole('button', { name: t.billing.superadmin.create.title, exact: true }),
  ).toHaveCount(0);
});
