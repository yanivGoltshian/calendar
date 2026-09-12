import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`sensitive surfaces expose only scoped watermarks and permitted settings at ${width}px`, async ({ page, context }) => {
    const f = await bookingFixture();
    const privateNotes = `private-plan-${f.business.id}`;
    const privateImport = `private-import-${f.business.id}`;
    const privateOnboarding = `private-onboarding-${f.business.id}`;
    const signIn = async (email: string) => {
      const token = await encode({
        token: { email }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
    };
    try {
      await prisma.business.update({
        where: { id: f.business.id },
        data: { planNotes: privateNotes, businessImportDraft: { notes: privateImport } },
      });
      await prisma.businessSettings.update({
        where: { businessId: f.business.id },
        data: { onboardingCompleted: true, onboardingSteps: { draft: privateOnboarding } },
      });
      await page.setViewportSize({ width, height: 844 });
      await signIn(f.business.ownerEmail!);
      const settingsResponse = await page.goto('/admin/settings');
      expect(settingsResponse!.ok()).toBe(true);
      expect(settingsResponse!.headers()['cache-control']).toContain('no-store');
      const html = await settingsResponse!.text();
      for (const privateValue of [privateNotes, privateImport, privateOnboarding]) {
        expect(html).not.toContain(privateValue);
      }
      const watermark = page.locator('[data-sensitive-watermark]');
      await expect(watermark).toHaveCount(1);
      const ownerId = await watermark.getAttribute('data-sensitive-watermark');
      expect(ownerId).toMatch(/^[A-F0-9]{10}$/);
      await expect(watermark).toHaveAttribute('aria-hidden', 'true');
      expect(await watermark.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
      await page.goto('/admin/marketing');
      await expect(watermark).toHaveAttribute('data-sensitive-watermark', ownerId!);
      const denied = await page.goto('/superadmin');
      await expect(page.getByRole('heading', { name: t.brand.states.notFoundTitle, exact: true })).toBeVisible();
      await expect(page.locator('[aria-controls="new-customer-form"]')).toHaveCount(0);
      const deniedHtml = await denied!.text();
      for (const privateValue of [privateNotes, privateImport, privateOnboarding, 'new-customer-form']) {
        expect(deniedHtml).not.toContain(privateValue);
      }
      await expect(watermark).toHaveCount(0);
      await signIn('yanivgolt@gmail.com');
      const adminResponse = await page.goto('/superadmin');
      expect(adminResponse!.ok()).toBe(true);
      expect(adminResponse!.headers()['cache-control']).toContain('no-store');
      await expect(watermark).toHaveCount(1);
      const platformId = await watermark.getAttribute('data-sensitive-watermark');
      expect(platformId).toMatch(/^[A-F0-9]{10}$/);
      expect(platformId).not.toBe(ownerId);
      await context.clearCookies();
      await page.goto(`/b/${f.business.slug}`);
      await expect(watermark).toHaveCount(0);
    } finally {
      await cleanupFixture(f);
    }
  });
}
