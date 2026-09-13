import { encode } from 'next-auth/jwt';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`owner sees count-only monthly message quota on settings and marketing at ${width}px`, async ({
    page,
    context,
  }) => {
    const f = await bookingFixture();
    const other = await bookingFixture();
    try {
      const now = new Date();
      const previousMonth = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - 1,
        15,
      ));
      await prisma.business.update({
        where: { id: f.business.id },
        data: {
          plan: 'exclusive',
          subscriptionStatus: 'active',
          paidUntil: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      await prisma.messageLog.createMany({
        data: [
          { businessId: f.business.id, body: 'sent', channel: 'sms', status: 'SENT', costAgorot: 10, countsToCap: true },
          { businessId: f.business.id, body: 'reserved', channel: 'sms', status: 'RESERVED', costAgorot: 10, countsToCap: true },
          { businessId: f.business.id, body: 'unknown', channel: 'sms', status: 'UNKNOWN', costAgorot: 10, countsToCap: true },
          { businessId: f.business.id, body: 'failed', channel: 'sms', status: 'FAILED', costAgorot: 0, countsToCap: true },
          { businessId: f.business.id, body: 'old', channel: 'sms', status: 'SENT', costAgorot: 10, countsToCap: true, createdAt: previousMonth },
          { businessId: other.business.id, body: 'other tenant', channel: 'sms', status: 'SENT', costAgorot: 1000, countsToCap: true },
        ],
      });
      const token = await encode({
        token: { email: f.business.ownerEmail },
        secret: process.env.AUTH_SECRET!,
        salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

      for (const path of ['/admin/settings', '/admin/marketing']) {
        await page.goto(path);
        const heading = page.getByRole('heading', {
          name: t.admin.settings.costGuard.title,
          exact: true,
        });
        await expect(heading).toHaveCount(1);
        const panel = page.locator('section').filter({ has: heading });
        await expect(panel).toContainText('3');
        await expect(panel).toContainText('450');
        await expect(panel).toContainText('447');
        await expect(panel).not.toContainText('₪');
        await expect(panel).not.toContainText('45.00');
      }
    } finally {
      await cleanupFixture(f);
      await cleanupFixture(other);
    }
  });
}
