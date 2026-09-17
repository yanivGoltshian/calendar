import { encode } from 'next-auth/jwt';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';
import { parseAdminFormState } from '../src/lib/adminFormState';
import { readServiceCategories } from '../src/lib/serviceCategories';
import { installInvitationKey } from '../src/lib/pwa/installInvitationVisit';

test.afterAll(() => prisma.$disconnect());
const text = t.serviceCategories;

async function confirmedSave(page: Page, trigger: () => Promise<void>) {
  const response = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/admin/service-categories' &&
    response.request().method() === 'POST');
  await trigger();
  const result = parseAdminFormState(await (await response).json());
  expect(result.ok).toBe(true);
  expect(result.categories).toBeDefined();
  return result.categories!;
}

async function openManager(page: Page) {
  const manager = page.locator('[data-service-categories]');
  await expect(manager).toHaveAttribute('data-hydrated', 'true');
  await expect(manager).not.toHaveAttribute('open', '');
  await manager.locator('summary').click();
  return manager;
}

async function choose(manager: Locator, name: string) {
  await manager.getByRole('button', { name: text.add, exact: false }).click();
  await manager.getByLabel(text.name, { exact: true }).fill(name);
  return manager.getByRole('form', { name: text.editor });
}

for (const width of [1366, 390]) {
  test(`owner categories filter the unchanged booking widget and listing at ${width}px`, async ({ page, context }) => {
    test.setTimeout(120_000);
    const f = await bookingFixture();
    const foreign = await bookingFixture();
    try {
      await prisma.business.update({
        where: { id: f.business.id },
        data: {
          publicPageStyle: 'LANDING',
          landingContent: { heroHeadline: 'Studio Noa', heroSubtext: 'Synthetic category fixture' },
          settings: { update: { onboardingSteps: { services: true, hours: true, branding: true, richContent: true } } },
        },
      });
      const second = await prisma.service.create({ data: {
        businessId: f.business.id, name: 'Synthetic facial', sortOrder: 1, durationMin: 20, priceAgorot: 4000,
        staffLinks: { create: { staffId: f.staff.id } },
      } });
      await prisma.service.create({ data: {
        businessId: f.business.id, name: 'Synthetic unassigned', sortOrder: 2, durationMin: 15, priceAgorot: 2000,
        staffLinks: { create: { staffId: f.staff.id } },
      } });
      const token = await encode({
        token: { email: f.business.ownerEmail },
        secret: process.env.AUTH_SECRET!,
        salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      const invitationKeys = ['admin', 'business'].map(variant =>
        installInvitationKey(variant, `/b/${f.business.slug}`, undefined, f.business.slug));
      if (invitationKeys.some(key => key === null)) throw new Error('Synthetic invitation keys are required');
      await page.addInitScript(keys => {
        for (const key of keys) {
          if (key) localStorage.setItem(key, JSON.stringify({ shown: 1, lastShownAt: Date.now(), disabled: true }));
        }
      }, invitationKeys);
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/availability', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({ ok: true, slots: [] }),
      }));
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('#lp-book')).toBeVisible();
      await expect(page.getByRole('group', { name: text.browse })).toHaveCount(0);
      const originalServiceClasses = await page.locator('#lp-book').getByRole('button', {
        name: f.service.name, exact: true,
      }).getAttribute('class');
      const originalListing = await page.locator('#lp-services').innerHTML();
      const originalHeader = await page.locator('#lp-book h2').evaluate(node => node.outerHTML);

      await page.goto('/admin/services');
      const manager = await openManager(page);
      const serviceCard = page.locator(`[data-service-id="${f.service.id}"]`);
      await serviceCard.getByRole('link', { name: t.admin.services.edit, exact: true }).click();
      const inlineForm = page.getByRole('form', { name: t.admin.services.editTitle, exact: true });
      await expect(inlineForm).toHaveAttribute('data-hydrated', 'true');
      await inlineForm.getByLabel(t.admin.services.nameLabel, { exact: true }).fill('Preserved inline draft');
      const enabled = await confirmedSave(page, () => manager.getByLabel(text.enable).click());
      expect(enabled.enabled).toBe(true);
      await expect(manager.getByLabel(text.enable)).toBeChecked();
      const editor = await choose(manager, 'Face care');
      await editor.getByLabel(second.name, { exact: true }).check();
      await confirmedSave(page, () => editor.getByRole('button', { name: text.save, exact: true }).click());
      const empty = await choose(manager, 'Empty category');
      await confirmedSave(page, () => empty.getByRole('button', { name: text.save, exact: true }).click());
      await expect(inlineForm.getByLabel(t.admin.services.nameLabel, { exact: true })).toHaveValue('Preserved inline draft');
      await page.goto('/admin/onboarding?step=services');
      const onboarding = await openManager(page);
      await expect(onboarding.locator('li').filter({ hasText: 'Face care' })).toBeVisible();
      await expect(onboarding.getByLabel(text.enable)).toBeChecked();
      await page.getByRole('button', { name: t.admin.onboarding.services.addOwn, exact: false }).click();
      await page.locator('[name="newName"]').fill('New onboarding service');
      await page.locator('[name="newCategoryId"]').selectOption({ label: 'Face care' });
      await page.getByRole('button', { name: t.admin.onboarding.services.addCta, exact: true }).click();
      await expect(page.locator('li').filter({ hasText: 'New onboarding service' }).getByRole('combobox')).not.toHaveValue('');
      await page.getByRole('button', { name: t.admin.onboarding.services.removeAdded, exact: true }).click();
      await page.getByRole('button', { name: t.admin.onboarding.services.cancelAdd, exact: true }).click();

      await page.goto(`/b/${f.business.slug}`);
      const picker = page.locator('#lp-book');
      const pickerTabs = picker.getByRole('group', { name: text.browse });
      const listing = page.locator('#lp-services');
      await expect(pickerTabs).toBeVisible();
      await expect(picker.getByRole('button', { name: f.service.name, exact: true })).toHaveAttribute('class', originalServiceClasses!);
      expect(await picker.locator('h2').evaluate(node => node.outerHTML)).toBe(originalHeader);
      const tabsPosition = await pickerTabs.boundingBox();
      const labelPosition = await picker.getByText(t.premiumLanding.clinic.booking.treatmentLabel, { exact: true }).boundingBox();
      expect(tabsPosition!.y + tabsPosition!.height).toBeLessThanOrEqual(labelPosition!.y);
      await pickerTabs.getByRole('button', { name: /^Face care/ }).click();
      await expect(picker.getByRole('button', { name: f.service.name, exact: true })).toHaveCount(0);
      const selected = picker.getByRole('button', { name: second.name, exact: true });
      await selected.click();
      await expect(selected).toHaveAttribute('aria-pressed', 'true');
      await expect(picker.getByRole('link', { name: t.premiumLanding.clinic.booking.cta })).toHaveAttribute('href', new RegExp(`service=${second.id}`));
      await pickerTabs.getByRole('button', { name: new RegExp(`^${text.uncategorized}`) }).click();
      await expect(selected).toHaveCount(0);
      await expect(picker.getByRole('link', { name: t.premiumLanding.clinic.booking.cta })).not.toHaveAttribute('href', /[?&]service=/);
      await pickerTabs.getByRole('button', { name: /^Empty category/ }).click();
      await expect(picker.getByText(text.empty)).toBeVisible();
      await picker.getByRole('button', { name: text.showAll }).click();
      await expect(picker.getByRole('button', { name: f.service.name, exact: true })).toBeVisible();
      await listing.getByRole('group', { name: text.browse }).getByRole('button', { name: /^Face care/ }).click();
      await expect(listing.getByRole('link')).toHaveCount(1);
      await expect(listing.getByRole('link')).toHaveAttribute('href', new RegExp(`service=${second.id}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await page.goto('/admin/services');
      const updatedManager = await openManager(page);
      const row = updatedManager.locator('li').filter({ hasText: 'Face care' });
      await row.getByRole('button', { name: text.edit, exact: true }).click();
      const edit = updatedManager.getByRole('form', { name: text.editor });
      await edit.getByLabel(text.name).fill('Updated care');
      await edit.getByLabel(f.service.name, { exact: true }).check();
      await edit.getByLabel(second.name, { exact: true }).uncheck();
      const saved = await confirmedSave(page, () => edit.getByRole('button', { name: text.save, exact: true }).click());
      const rejected = await page.evaluate(async ({ foreignId, saved }) => {
        const data = new FormData();
        data.set('categories', JSON.stringify({
          ...saved, categories: [{ id: 'foreign', name: 'Foreign', serviceIds: [foreignId] }],
        }));
        const response = await fetch('/api/admin/service-categories', { method: 'POST', body: data });
        return { status: response.status, body: await response.json() };
      }, { foreignId: foreign.service.id, saved });
      expect(rejected).toEqual({ status: 400, body: { ok: false, error: 'invalid_service' } });

      await page.goto(`/b/${f.business.slug}`);
      await page.locator('#lp-book').getByRole('group', { name: text.browse })
        .getByRole('button', { name: /^Updated care/ }).click();
      await expect(page.locator('#lp-book').getByRole('button', { name: f.service.name, exact: true })).toBeVisible();
      await expect(page.locator('#lp-book').getByRole('button', { name: second.name, exact: true })).toHaveCount(0);
      await page.goto('/admin/services');
      const lastManager = await openManager(page);
      const disabled = await confirmedSave(page, () => lastManager.getByLabel(text.enable).click());
      expect(disabled.enabled).toBe(false);
      await expect(lastManager.getByLabel(text.enable)).not.toBeChecked();
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByRole('group', { name: text.browse })).toHaveCount(0);
      expect(await page.locator('#lp-services').innerHTML()).toBe(originalListing);
      const stored = readServiceCategories((await prisma.business.findUniqueOrThrow({
        where: { id: f.business.id },
      })).serviceCategories);
      expect(stored.enabled).toBe(false);
      expect(stored.categories[0].name).toBe('Updated care');
    } finally {
      await cleanupFixture(f);
      await cleanupFixture(foreign);
    }
  });
}
