import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { INSTALL_INVITATION_COOLDOWN } from '../src/lib/pwa/installInvitations';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`installation invitations are bounded, dismissible and installation-aware at ${width}px`, async ({ page }) => {
    const f = await bookingFixture();
    const key = `torchick:install-invite:v1:business:${f.business.slug}`;
    try {
      await prisma.businessSettings.update({ where: { businessId: f.business.id }, data: { onboardingCompleted: true } });
      await page.setViewportSize({ width, height: 844 });
      await page.clock.install();
      await page.goto(`/b/${f.business.slug}`);
      const invitation = page.getByTestId('install-invitation');
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.evaluate(key => {
        localStorage.setItem(key.replace(':business:', ':admin:'), JSON.stringify({ shown: 3, lastShownAt: Date.now(), disabled: true }));
      }, key);
      await page.getByRole('button', { name: t.install.button, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
      await page.getByRole('button', { name: t.install.gotIt, exact: true }).click();
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(9000);
      await expect(invitation).toBeVisible();
      await invitation.getByRole('button', { name: t.install.button, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: t.install.gotIt, exact: true }).click();
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      for (const shown of [2, 3]) {
        await page.evaluate(({ key, cooldown }) => {
          const state = JSON.parse(localStorage.getItem(key)!);
          localStorage.setItem(key, JSON.stringify({ ...state, lastShownAt: Date.now() - cooldown }));
        }, { key, cooldown: INSTALL_INVITATION_COOLDOWN });
        await page.reload();
        await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
        await page.clock.fastForward(9000);
        await expect(invitation).toBeVisible();
        expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).shown, key)).toBe(shown);
        await invitation.getByRole('button', { name: t.install.later, exact: true }).click();
      }
      await page.evaluate(key => {
        const state = JSON.parse(localStorage.getItem(key)!);
        localStorage.setItem(key, JSON.stringify({ ...state, lastShownAt: 1 }));
      }, key);
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);

      await page.evaluate(key => localStorage.removeItem(key), key);
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(9000);
      await invitation.getByRole('button', { name: t.install.neverAgain, exact: true }).click();
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).disabled, key)).toBe(true);
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(INSTALL_INVITATION_COOLDOWN);
      await expect(invitation).toHaveCount(0);

      // Installation can happen through the browser before the first invitation timer.
      await page.evaluate(key => localStorage.removeItem(key), key);
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toHaveCount(0);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key))
        .toEqual({ shown: 0, lastShownAt: 0, disabled: true });
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      await page.evaluate(key => localStorage.removeItem(key), key);
      await page.reload();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toBeVisible();
      await page.evaluate(() => {
        const event = new Event('beforeinstallprompt');
        Object.defineProperties(event, {
          prompt: { value: async () => undefined },
          userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
        });
        window.dispatchEvent(event);
      });
      await page.getByRole('button', { name: t.install.button, exact: true }).click();
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toHaveCount(0);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).disabled, key)).toBe(true);
      await page.evaluate(key => localStorage.removeItem(key), key);
      await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
      await page.reload();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      await expect(page.getByRole('button', { name: t.install.button, exact: true })).toHaveCount(0);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).disabled, key)).toBe(true);
    } finally {
      await cleanupFixture(f);
    }
  });
}
