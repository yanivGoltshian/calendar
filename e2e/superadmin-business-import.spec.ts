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
    expect(businesses[0]?.services.map(({ name }) => name).sort()).toEqual([
      'אבחון עור',
      'טיפול פנים',
    ]);
    expect(businesses[0]?.workingHours).toHaveLength(6);
    await expect(page.getByText('נושאים שדורשים בדיקה')).toBeVisible();
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
