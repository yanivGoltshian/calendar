import { encode } from 'next-auth/jwt';
import type { Locator, Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';

const text = t.admin.services;
test.afterAll(() => prisma.$disconnect());

async function ready(form: Locator) {
  await expect(form).toHaveAttribute('data-hydrated', 'true');
}

async function save(page: Page, form: Locator) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/admin/services',
  );
  await form.getByRole('button', { name: text.submitEdit, exact: true }).click();
  return response;
}

for (const width of [1366, 390]) {
  test(`service cards edit in place, preserve drafts and return updated values at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(120_000);
    const fixture = await bookingFixture();
    const foreign = await bookingFixture();
    try {
      const staff = await prisma.staffMember.create({
        data: { businessId: fixture.business.id, displayName: 'Second synthetic staff' },
      });
      const selected = await prisma.service.create({
        data: {
          businessId: fixture.business.id,
          sortOrder: 1,
          name: 'Second synthetic service',
          description: 'Original description',
          durationMin: 45,
          priceAgorot: 12345,
          hidePrice: true,
          hideDuration: true,
          hidden: true,
          staffLinks: { create: { staffId: fixture.staff.id } },
        },
      });
      await prisma.service.create({
        data: {
          businessId: fixture.business.id,
          sortOrder: 2,
          name: 'Third synthetic service',
          durationMin: 20,
          priceAgorot: 2500,
          staffLinks: { create: { staffId: fixture.staff.id } },
        },
      });
      const token = await encode({
        token: { email: fixture.business.ownerEmail },
        secret: process.env.AUTH_SECRET!,
        salt: 'authjs.session-token',
      });
      await context.addCookies([
        { name: 'authjs.session-token', value: token, url: BASE_URL },
      ]);
      await page.setViewportSize({ width, height: 900 });
      let documentLoads = 0;
      page.on('request', (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame())
          documentLoads++;
      });
      await page.goto('/admin/services');
      const card = page.locator(`[data-service-id="${selected.id}"]`);
      const first = page.locator(`[data-service-id="${fixture.service.id}"]`);
      const edit = page.getByRole('form', { name: text.editTitle, exact: true });
      const add = page.getByRole('form', { name: text.addTitle, exact: true });
      await ready(add);
      await add.getByLabel(text.nameLabel, { exact: true }).fill('Separate add draft');
      await card
        .getByRole('link', { name: text.edit, exact: true })
        .scrollIntoViewIfNeeded();
      const before = await card.boundingBox();
      await card.getByRole('link', { name: text.edit, exact: true }).click();
      await ready(edit);
      expect(
        await edit.evaluate((form) =>
          form.closest('li')?.getAttribute('data-service-id'),
        ),
      ).toBe(selected.id);
      await expect(edit).toHaveCount(1);
      expect(Math.abs((await card.boundingBox())!.y - before!.y)).toBeLessThan(3);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toBeFocused();
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        selected.name,
      );
      await expect(edit.getByLabel(text.descriptionLabel, { exact: true })).toHaveValue(
        'Original description',
      );
      await expect(edit.getByLabel(text.durationLabel, { exact: true })).toHaveValue(
        '45',
      );
      await expect(edit.getByLabel(text.priceLabel, { exact: true })).toHaveValue(
        '123.45',
      );
      for (const label of [
        text.hidePriceLabel,
        text.hideDurationLabel,
        text.hiddenLabel,
        fixture.staff.displayName,
      ]) {
        await expect(edit.getByLabel(label, { exact: true })).toBeChecked();
      }
      expect(
        await page
          .locator('input[id], textarea[id]')
          .evaluateAll(
            (controls) =>
              new Set(controls.map((control) => control.id)).size === controls.length,
          ),
      ).toBe(true);
      await expect(add.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        'Separate add draft',
      );
      await info.attach(`inline-editor-${width}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await edit.getByLabel(text.nameLabel, { exact: true }).fill('Cancelled draft');
      let cancelRequests = 0;
      const blockCancelNavigation = async (route: Route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/admin/services' && !url.searchParams.has('edit')) {
          cancelRequests++;
          await route.abort('failed');
        } else {
          await route.fallback();
        }
      };
      await page.route('**/admin/services*', blockCancelNavigation);
      await card.getByRole('button', { name: text.cancelEdit, exact: true }).click();
      await expect(edit).toHaveCount(0);
      await expect(page).toHaveURL(/\/admin\/services$/);
      expect(cancelRequests).toBe(0);
      await page.unroute('**/admin/services*', blockCancelNavigation);
      await expect(
        card.getByRole('link', { name: text.edit, exact: true }),
      ).toBeFocused();
      expect(
        (await prisma.service.findUniqueOrThrow({ where: { id: selected.id } })).name,
      ).toBe(selected.name);
      await expect(
        card.getByRole('link', { name: text.edit, exact: true }),
      ).toBeInViewport();

      await page.goBack();
      await ready(edit);
      await expect(edit.locator('input[name=id]')).toHaveValue(selected.id);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        selected.name,
      );
      await page.goForward();
      await expect(edit).toHaveCount(0);
      await expect(page).toHaveURL(/\/admin\/services$/);

      await card.getByRole('link', { name: text.edit, exact: true }).click();
      await ready(edit);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        selected.name,
      );
      await edit
        .getByLabel(text.nameLabel, { exact: true })
        .fill('Draft retained on failure');
      await edit
        .getByLabel(text.descriptionLabel, { exact: true })
        .fill('Changed description');
      await edit.getByLabel(text.durationLabel, { exact: true }).fill('55');
      await edit.getByLabel(text.priceLabel, { exact: true }).fill('98.76');
      for (const label of [
        text.hidePriceLabel,
        text.hideDurationLabel,
        text.hiddenLabel,
        fixture.staff.displayName,
      ]) {
        await edit.getByLabel(label, { exact: true }).uncheck();
      }
      const failed = await save(page, edit);
      expect(failed.status()).toBe(400);
      await expect(edit.getByRole('alert')).toHaveText(text.errorStaff);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        'Draft retained on failure',
      );
      await expect(edit.getByLabel(text.descriptionLabel, { exact: true })).toHaveValue(
        'Changed description',
      );
      await expect(edit.getByLabel(text.durationLabel, { exact: true })).toHaveValue(
        '55',
      );
      await expect(edit.getByLabel(text.priceLabel, { exact: true })).toHaveValue(
        '98.76',
      );
      await expect(edit.getByLabel(text.hiddenLabel, { exact: true })).not.toBeChecked();
      expect(
        (await prisma.service.findUniqueOrThrow({ where: { id: selected.id } })).name,
      ).toBe(selected.name);

      await page.route(
        '**/api/admin/services',
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'text/plain',
            body: 'Unconfirmed synthetic response',
          }),
        { times: 1 },
      );
      await save(page, edit);
      await expect(edit.getByRole('alert')).toHaveText(t.common.saveUnconfirmed);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        'Draft retained on failure',
      );

      await first.getByRole('link', { name: text.edit, exact: true }).click();
      await ready(edit);
      await expect(edit.locator('input[name=id]')).toHaveValue(fixture.service.id);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        fixture.service.name,
      );
      await expect(edit.getByRole('alert')).toHaveCount(0);
      await card.getByRole('link', { name: text.edit, exact: true }).click();
      await ready(edit);
      await expect(edit.locator('input[name=id]')).toHaveValue(selected.id);
      await expect(edit.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        selected.name,
      );

      await edit
        .getByLabel(text.nameLabel, { exact: true })
        .fill('Updated synthetic service');
      await edit
        .getByLabel(text.descriptionLabel, { exact: true })
        .fill('Updated description');
      await edit.getByLabel(text.durationLabel, { exact: true }).fill('55');
      await edit.getByLabel(text.priceLabel, { exact: true }).fill('98.76');
      for (const label of [
        text.hidePriceLabel,
        text.hideDurationLabel,
        text.hiddenLabel,
        fixture.staff.displayName,
      ]) {
        await edit.getByLabel(label, { exact: true }).uncheck();
      }
      await edit.getByLabel(staff.displayName, { exact: true }).check();
      let releaseSave!: () => void;
      const heldSave = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      await page.route(
        '**/api/admin/services',
        async (route) => {
          await heldSave;
          await route.continue();
        },
        { times: 1 },
      );
      const saved = save(page, edit);
      await expect(edit).toHaveAttribute('aria-busy', 'true');
      await expect(
        edit.getByRole('button', { name: t.common.loading, exact: true }),
      ).toBeDisabled();
      await expect(edit).toBeVisible();
      releaseSave();
      expect((await saved).ok()).toBe(true);
      await expect(edit).toHaveCount(0);
      await expect(page).toHaveURL(/\/admin\/services$/);
      await expect(card).toContainText('Updated synthetic service');
      await expect(card).toContainText('Updated description');
      await expect(card).toContainText(staff.displayName);
      await expect(card).not.toContainText(text.priceHidden);
      await expect(card).not.toContainText(text.durationHidden);
      await expect(card).not.toContainText(text.hiddenBadge);
      await expect(
        card.getByRole('link', { name: text.edit, exact: true }),
      ).toBeFocused();
      await expect(
        card.getByRole('link', { name: text.edit, exact: true }),
      ).toBeInViewport();
      expect(documentLoads).toBe(1);
      const persisted = await prisma.service.findUniqueOrThrow({
        where: { id: selected.id },
        include: { staffLinks: true },
      });
      expect({
        name: persisted.name,
        description: persisted.description,
        durationMin: persisted.durationMin,
        priceAgorot: persisted.priceAgorot,
        hidePrice: persisted.hidePrice,
        hideDuration: persisted.hideDuration,
        hidden: persisted.hidden,
        staffIds: persisted.staffLinks.map((link) => link.staffId),
      }).toEqual({
        name: 'Updated synthetic service',
        description: 'Updated description',
        durationMin: 55,
        priceAgorot: 9876,
        hidePrice: false,
        hideDuration: false,
        hidden: false,
        staffIds: [staff.id],
      });
      expect(
        (await prisma.service.findUniqueOrThrow({ where: { id: fixture.service.id } }))
          .name,
      ).toBe(fixture.service.name);
      await expect(add.getByLabel(text.nameLabel, { exact: true })).toHaveValue(
        'Separate add draft',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await info.attach(`inline-saved-${width}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await add.getByLabel(text.durationLabel, { exact: true }).fill('25');
      await add.getByLabel(text.priceLabel, { exact: true }).fill('44.55');
      await add.getByLabel(staff.displayName, { exact: true }).check();
      await add.getByRole('button', { name: text.submitAdd, exact: true }).click();
      await expect(add.getByRole('status')).toHaveText(text.successAdded);
      await expect(add.getByLabel(text.nameLabel, { exact: true })).toHaveValue('');
      expect(documentLoads).toBe(2);
      expect(
        await prisma.service.count({
          where: {
            businessId: fixture.business.id,
            name: 'Separate add draft',
            priceAgorot: 4455,
          },
        }),
      ).toBe(1);

      for (const id of ['invalid-service-id', foreign.service.id]) {
        await page.goto(`/admin/services?edit=${id}`);
        await ready(add);
        await expect(edit).toHaveCount(0);
        await expect(
          page.locator(`[data-service-id="${foreign.service.id}"]`),
        ).toHaveCount(0);
      }
      expect(
        (await prisma.service.findUniqueOrThrow({ where: { id: foreign.service.id } }))
          .name,
      ).toBe(foreign.service.name);
    } finally {
      await cleanupFixture(fixture);
      await cleanupFixture(foreign);
    }
  });
}
