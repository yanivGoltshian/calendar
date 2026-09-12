import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { seedEngagementClients } from '../integration/engagement-fixtures';
import { ENGAGEMENT_SEGMENTS } from '../src/lib/clientEngagement';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`client engagement filters and scheduled audiences stay consistent at ${width}px`, async ({ page, context }) => {
    const f = await bookingFixture();
    const m = t.admin.marketingModule;
    try {
      const clients = await seedEngagementClients(f);
      await prisma.businessSettings.update({ where: { businessId: f.business.id }, data: { onboardingCompleted: true } });
      const token = await encode({
        token: { email: f.business.ownerEmail }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/admin/clients');
      for (const segment of ENGAGEMENT_SEGMENTS) {
        await page.getByRole('button', { name: `${t.common.moreInfo}: ${m.segments[segment]}`, exact: true }).click();
        await expect(page.getByRole('dialog', { name: m.segments[segment], exact: true })).toHaveText(m.segmentInfo[segment]);
        await page.keyboard.press('Escape');
        const navigation = page.waitForResponse(response => {
          const url = new URL(response.url());
          return response.request().isNavigationRequest()
            && url.pathname === '/admin/clients' && url.searchParams.get('filter') === segment;
        });
        await page.getByRole('link', { name: m.segments[segment], exact: true }).click();
        const response = await navigation;
        expect(response.ok()).toBe(true);
        expect(response.headers()['content-type']).toContain('text/html');
        await expect(page).toHaveURL(`/admin/clients?filter=${segment}`);
        await expect(page.getByRole('link', { name: m.segments[segment], exact: true })).toHaveAttribute('aria-current', 'page');
        const expected = segment === 'past_clients' ? clients.past : clients.recent;
        await expect(page.locator(`a[href="/admin/clients/${expected.id}"]`)).toBeVisible();
        await expect(page.locator(`a[href="/admin/clients/${clients.cancelled.id}"]`)).toHaveCount(0);
      }
      await page.goto('/admin/marketing');
      await expect(page.getByRole('checkbox', { name: m.channels.sms, exact: true })).toBeDisabled();
      await page.getByRole('button', { name: `${t.common.moreInfo}: ${m.channels.sms}`, exact: true }).click();
      const smsInfo = page.getByRole('dialog', { name: m.channels.sms, exact: true });
      await expect(smsInfo).toContainText(m.smsUpgradeInfo);
      await expect(smsInfo.getByRole('link', { name: m.smsUpgradeCta, exact: true })).toHaveAttribute('href', '/admin/upgrade');
      await page.keyboard.press('Escape');
      await page.locator('input[name=name]').fill('Synthetic scheduled returning audience');
      await page.locator('textarea[name=body]').fill('Synthetic delivery for isolated tests only');
      await page.getByRole('radio', { name: m.segments.returning, exact: true }).check();
      await page.getByRole('radio', { name: m.scheduleLater, exact: true }).check();
      await page.locator('input[name=scheduledAt]').fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
      await page.getByRole('button', { name: m.submitCreate, exact: true }).click();
      await expect(page.getByText(m.successScheduled, { exact: true })).toBeVisible();
      const campaigns = await prisma.campaign.findMany({ where: { businessId: f.business.id } });
      expect(campaigns).toHaveLength(1);
      expect(campaigns[0]).toMatchObject({ status: 'SCHEDULED', segment: 'returning', channels: ['email'] });
      expect(campaigns[0].scheduledAt!.getTime()).toBeGreaterThan(Date.now());
      expect(await prisma.messageLog.count({ where: { businessId: f.business.id } })).toBe(0);
    } finally {
      await cleanupFixture(f);
    }
  });
}
