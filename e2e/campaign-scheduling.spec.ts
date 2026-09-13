import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';
import { parseCampaignScheduledAt } from '../src/server/campaigns/schedule';

test.afterAll(() => prisma.$disconnect());

function futureJerusalemSpringTransition() {
  const startYear = new Date().getUTCFullYear() + 1;
  for (let year = startYear; year < startYear + 10; year += 1) {
    for (let day = 20; day <= 31; day += 1) {
      const date = `${year}-03-${String(day).padStart(2, '0')}`;
      const gapInput = `${date}T02:30`;
      const validInput = `${date}T03:00`;
      const validInstant = parseCampaignScheduledAt(validInput, 'Asia/Jerusalem');
      if (
        parseCampaignScheduledAt(gapInput, 'Asia/Jerusalem') === null &&
        validInstant &&
        validInstant.getTime() > Date.now()
      ) {
        return { gapInput, validInput, validInstant };
      }
    }
  }
  throw new Error('No future Jerusalem spring DST transition found');
}

for (const width of [390, 1366]) {
  test(`campaign UI rejects a DST gap and schedules the valid boundary at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = await bookingFixture();
    const transition = futureJerusalemSpringTransition();
    try {
      await page.setViewportSize({ width, height: 844 });
      const token = await encode({
        token: { email: fixture.business.ownerEmail },
        secret: process.env.AUTH_SECRET!,
        salt: 'authjs.session-token',
      });
      await context.addCookies([
        { name: 'authjs.session-token', value: token, url: BASE_URL },
      ]);
      await page.goto('/admin/marketing');

      await page.locator('input[name="name"]').fill('DST validation campaign');
      await page.locator('textarea[name="body"]').fill('Synthetic browser validation only');
      await page.locator('input[name="scheduleMode"][value="later"]').check();
      await page.locator('input[name="scheduledAt"]').fill(transition.gapInput);
      await page.getByRole('button', {
        name: t.admin.marketingModule.submitCreate,
        exact: true,
      }).click();
      await expect(page.getByText(t.admin.marketingModule.errorSchedule, {
        exact: true,
      })).toBeVisible();
      expect(await prisma.campaign.count({
        where: { businessId: fixture.business.id },
      })).toBe(0);

      await page.locator('input[name="scheduledAt"]').fill(transition.validInput);
      await page.getByRole('button', {
        name: t.admin.marketingModule.submitCreate,
        exact: true,
      }).click();
      await expect(page.getByText(t.admin.marketingModule.successScheduled, {
        exact: true,
      })).toBeVisible();

      const campaign = await prisma.campaign.findFirstOrThrow({
        where: { businessId: fixture.business.id },
      });
      expect(campaign.status).toBe('SCHEDULED');
      expect(campaign.scheduledAt?.toISOString()).toBe(transition.validInstant.toISOString());
      expect(campaign.channels).toEqual(['email']);
    } finally {
      await cleanupFixture(fixture);
    }
  });
}
