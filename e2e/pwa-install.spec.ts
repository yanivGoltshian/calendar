import { encode } from 'next-auth/jwt';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { INSTALL_INVITATION_COOLDOWN } from '../src/lib/pwa/installInvitations';
import { t } from '../src/i18n';

async function prepareBusiness() {
  const fixture = await bookingFixture();
  try {
    await prisma.businessSettings.update({
      where: { businessId: fixture.business.id },
      data: { onboardingCompleted: true },
    });
    return fixture;
  } catch (error) {
    await cleanupFixture(fixture);
    throw error;
  }
}

let sharedFixture: Awaited<ReturnType<typeof bookingFixture>>;

test.beforeAll(async () => {
  sharedFixture = await prepareBusiness();
});

test.afterAll(async () => {
  await cleanupFixture(sharedFixture);
  await prisma.$disconnect();
});

async function installClockAndOpen(page: Page, path: string) {
  await page.clock.install();
  await page.goto(path);
}

async function waitForPublicInstall(page: Page) {
  await expect(
    page.getByRole('button', { name: t.install.helpToggle, exact: true }),
  ).toBeVisible();
}

for (const width of [390, 1366]) {
  test(`PWA invitation lifecycle survives navigation, busy UI and install transitions at ${width}px`, async ({
    page,
  }) => {
    const fixture = sharedFixture;
    const key = `torchick:install-invite:v1:business:${fixture.business.slug}`;
    const invitation = page.getByTestId('install-invitation');
    {
      await page.setViewportSize({ width, height: 844 });
      await installClockAndOpen(page, `/b/${fixture.business.slug}`);
      await waitForPublicInstall(page);

      await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'pwa-focused-control';
        document.body.append(input);
        input.focus();
        const dialog = document.createElement('div');
        dialog.id = 'pwa-busy-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        document.body.append(dialog);
      });
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
      await page.evaluate(() => {
        document.querySelector('#pwa-focused-control')?.remove();
        document.querySelector('#pwa-busy-dialog')?.remove();
      });
      await page.clock.fastForward(2000);
      await expect(invitation).toBeVisible();
      expect(
        await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).shown, key),
      ).toBe(1);

      await invitation.getByRole('button', { name: t.install.later, exact: true }).click();
      await page.evaluate(({ storageKey, cooldown }) => {
        Object.defineProperty(window, 'pwaVisitMarker', { value: true, configurable: true });
        const state = JSON.parse(localStorage.getItem(storageKey)!);
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...state, lastShownAt: Date.now() - cooldown }),
        );
      }, { storageKey: key, cooldown: INSTALL_INVITATION_COOLDOWN });
      await page.locator('a[href="/"]').last().click();
      await expect(page).toHaveURL(new URL('/', process.env.E2E_BASE_URL!).href);
      await page.goBack();
      await waitForPublicInstall(page);
      expect(await page.evaluate(() => Reflect.get(window, 'pwaVisitMarker'))).toBe(true);
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(
        await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).shown, key),
      ).toBe(1);

      await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key);
      await page.reload();
      await waitForPublicInstall(page);
      await page.evaluate(() => Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      }));
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
      await page.evaluate(() => Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      }));
      await page.clock.fastForward(2000);
      await expect(invitation).toBeVisible();
      await invitation.getByRole('button', { name: t.install.later, exact: true }).click();

      await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key);
      await page.reload();
      await waitForPublicInstall(page);
      await page.getByRole('button', { name: t.install.helpToggle, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: t.install.gotIt, exact: true }).click();
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();

      await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key);
      await page.reload();
      await waitForPublicInstall(page);
      await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        Object.defineProperties(event, {
          prompt: {
            value: async () => {
              document.body.dataset.nativeInstallCalls = String(
                Number(document.body.dataset.nativeInstallCalls || '0') + 1,
              );
              throw new DOMException('Install prompt expired', 'NotAllowedError');
            },
          },
          userChoice: { value: Promise.resolve({ outcome: 'dismissed' }) },
        });
        window.dispatchEvent(event);
      });
      await page.clock.fastForward(9000);
      await invitation.getByRole('button', { name: t.install.button, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('body')).toHaveAttribute('data-native-install-calls', '1');
      await page.getByRole('button', { name: t.install.gotIt, exact: true }).click();
      await page.getByRole('button', { name: t.install.button, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('body')).toHaveAttribute('data-native-install-calls', '1');
    }
  });

  for (const installedSignal of ['display-mode', 'pageshow'] as const) {
    test(`PWA ${installedSignal} detection closes pending invitations at ${width}px`, async ({
      page,
    }) => {
      const fixture = sharedFixture;
      const key = `torchick:install-invite:v1:business:${fixture.business.slug}`;
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((signal) => {
        const original = window.matchMedia.bind(window);
        const displayMode = original('(display-mode: standalone)');
        let standalone = false;
        Object.defineProperty(displayMode, 'matches', {
          configurable: true,
          get: () => signal === 'display-mode' && standalone,
        });
        Object.defineProperty(navigator, 'standalone', {
          configurable: true,
          get: () => signal === 'pageshow' && standalone,
        });
        window.matchMedia = (query) =>
          query === '(display-mode: standalone)' ? displayMode : original(query);
        window.addEventListener('pwa-test:installed', () => {
          standalone = true;
          if (signal === 'display-mode') {
            displayMode.dispatchEvent(new Event('change'));
          } else {
            window.dispatchEvent(new PageTransitionEvent('pageshow'));
          }
        });
      }, installedSignal);
      await installClockAndOpen(page, `/b/${fixture.business.slug}`);
      await waitForPublicInstall(page);
      const invitation = page.getByTestId('install-invitation');
      await page.clock.fastForward(9000);
      await expect(invitation).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('pwa-test:installed')));
      await expect(invitation).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: t.install.button, exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          (storageKey) => JSON.parse(localStorage.getItem(storageKey)!).disabled,
          key,
        ),
      ).toBe(true);
    });
  }

  test(`two InstallApp instances atomically share one native prompt at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = sharedFixture;
    const key = `torchick:install-invite:v1:admin:${fixture.business.slug}`;
    {
      await page.setViewportSize({ width, height: 844 });
      const token = await encode({
        token: { email: fixture.business.ownerEmail },
        secret: process.env.AUTH_SECRET!,
        salt: 'authjs.session-token',
      });
      await context.addCookies([
        { name: 'authjs.session-token', value: token, url: BASE_URL },
      ]);
      await installClockAndOpen(page, '/admin/settings');
      if (width === 390) {
        await page.getByRole('button', { name: 'עוד', exact: true }).evaluate((button) => {
          (button as HTMLButtonElement).click();
        });
      }

      const triggers = page.locator(`button[aria-label="${t.install.adminSubtitle}"]`);
      await expect(triggers).toHaveCount(2);
      await page.evaluate(() => {
        let resolvePrompt!: () => void;
        let resolveChoice!: (value: { outcome: 'dismissed' }) => void;
        const promptGate = new Promise<void>((resolve) => {
          resolvePrompt = resolve;
        });
        const choiceGate = new Promise<{ outcome: 'dismissed' }>((resolve) => {
          resolveChoice = resolve;
        });
        const event = new Event('beforeinstallprompt', { cancelable: true });
        Object.defineProperties(event, {
          prompt: {
            value: async () => {
              document.body.dataset.nativeInstallCalls = String(
                Number(document.body.dataset.nativeInstallCalls || '0') + 1,
              );
              await promptGate;
            },
          },
          userChoice: { value: choiceGate },
        });
        Object.assign(window, {
          pwaPromptEvent: event,
          resolvePwaPrompt: resolvePrompt,
          resolvePwaChoice: resolveChoice,
        });
        window.dispatchEvent(event);
      });
      await expect(triggers.nth(0)).not.toHaveAttribute('aria-haspopup', 'dialog');
      await expect(triggers.nth(1)).not.toHaveAttribute('aria-haspopup', 'dialog');
      const clickOrder = width === 390 ? [0, 1] : [1, 0];
      await triggers.evaluateAll((buttons, order) => {
        for (const index of order as number[]) {
          (buttons[index] as HTMLButtonElement).click();
        }
      }, clickOrder);

      await expect(page.locator('body')).toHaveAttribute('data-native-install-calls', '1');
      await expect(page.getByRole('heading', {
        name: t.install.desktopTitle,
        exact: true,
      })).toBeVisible();
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
      await page.evaluate(() => {
        const testWindow = window as typeof window & {
          resolvePwaPrompt: () => void;
          resolvePwaChoice: (value: { outcome: 'dismissed' }) => void;
          pwaPromptEvent: Event;
        };
        testWindow.resolvePwaPrompt();
        testWindow.resolvePwaChoice({ outcome: 'dismissed' });
        window.dispatchEvent(testWindow.pwaPromptEvent);
      });
      await page.clock.fastForward(9000);
      await expect(page.getByTestId('install-invitation')).toHaveCount(0);
      await page.getByRole('button', { name: t.install.gotIt, exact: true }).click();
      const visibleTrigger = width === 390 ? triggers.nth(1) : triggers.nth(0);
      await visibleTrigger.evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
      await expect(page.locator('body')).toHaveAttribute('data-native-install-calls', '1');
      await expect(page.getByRole('heading', {
        name: t.install.desktopTitle,
        exact: true,
      })).toBeVisible();
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
    }
  });

  test(`hidden admin dialogs do not suppress invitations at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = sharedFixture;
    const key = `torchick:install-invite:v1:admin:${fixture.business.slug}`;
    await page.setViewportSize({ width, height: 844 });
    const token = await encode({
      token: { email: fixture.business.ownerEmail },
      secret: process.env.AUTH_SECRET!,
      salt: 'authjs.session-token',
    });
    await context.addCookies([
      { name: 'authjs.session-token', value: token, url: BASE_URL },
    ]);
    await installClockAndOpen(page, '/admin/settings');
    const triggers = page.locator(`button[aria-label="${t.install.adminSubtitle}"]`);
    await expect(triggers).toHaveCount(2);
    const invitation = page.getByTestId('install-invitation');

    if (width === 390) {
      await page.getByRole('button', { name: 'עוד', exact: true }).evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
      await page.clock.fastForward(9000);
      await expect(invitation).toHaveCount(0);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
      await page.getByRole('button', { name: 'סגירה', exact: true }).click();
      await page.clock.fastForward(2000);
    } else {
      await page.clock.fastForward(9000);
    }

    await expect(invitation).toBeVisible();
    expect(
      await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).shown, key),
    ).toBe(1);
  });
}
