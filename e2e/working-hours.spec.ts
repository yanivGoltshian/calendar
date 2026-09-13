import { encode } from 'next-auth/jwt';
import type { BrowserContext, Response } from '@playwright/test';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';

const text = t.admin.workingHours;
test.afterAll(() => prisma.$disconnect());

function isWorkingHoursResponse(response: Response) {
  return response.request().method() === 'POST' &&
    new URL(response.url()).pathname === '/api/admin/working-hours';
}

async function signIn(
  context: BrowserContext,
  email: string | null,
) {
  if (!email) throw new Error('Fixture owner email is required');
  const token = await encode({
    token: { email },
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token',
  });
  await context.addCookies([{
    name: 'authjs.session-token',
    value: token,
    url: BASE_URL,
  }]);
}

test('desktop owner adds, removes, sorts and clears multiple business breaks through fixed JSON transport', async ({
  page,
  context,
  request,
}) => {
  const fixture = await bookingFixture();
  let documentLoads = 0;
  page.on('response', (response) => {
    if (
      response.request().isNavigationRequest() &&
      new URL(response.url()).pathname === '/admin/working-hours'
    ) {
      documentLoads++;
    }
  });
  try {
    await prisma.workingHours.updateMany({
      where: { businessId: fixture.business.id, scope: 'BUSINESS', weekday: 0 },
      data: { breaks: [[900, 930], [720, 750]] },
    });
    expect((await request.post('/api/admin/working-hours', {
      headers: { origin: BASE_URL },
      multipart: { open_0: 'on', start_0: '09:00', end_0: '17:00' },
    })).status()).toBe(403);

    await signIn(context, fixture.business.ownerEmail);
    expect((await context.request.post('/api/admin/working-hours', {
      headers: { origin: BASE_URL },
      data: { open_0: 'on', start_0: '09:00', end_0: '17:00' },
    })).status()).toBe(415);
    expect((await context.request.post('/api/admin/working-hours', {
      multipart: { open_0: 'on', start_0: '09:00', end_0: '17:00' },
    })).status()).toBe(403);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin/working-hours');
    const form = page.getByRole('form', { name: text.title, exact: true });
    const sunday = form.locator('li').filter({ hasText: text.weekdays.sunday }).first();
    await expect(sunday.getByLabel(text.breakStartLabel, { exact: true })).toHaveValue('12:00');
    await expect(sunday.getByLabel(`${text.breakStartLabel} 2`, { exact: true })).toHaveValue('15:00');

    await sunday.getByRole('button', {
      name: `${text.addBreak} ${text.weekdays.sunday}`,
      exact: true,
    }).click();
    await sunday.getByLabel(`${text.breakStartLabel} 3`, { exact: true }).fill('16:00');
    await sunday.getByLabel(`${text.breakEndLabel} 3`, { exact: true }).fill('16:15');
    await sunday.getByRole('button', {
      name: `${text.removeBreak} 2 ${text.weekdays.sunday}`,
      exact: true,
    }).click();
    await sunday.getByLabel(`${text.breakStartLabel} 2`, { exact: true }).fill('11:00');
    await sunday.getByLabel(`${text.breakEndLabel} 2`, { exact: true }).fill('11:15');

    const responsePromise = page.waitForResponse(isWorkingHoursResponse);
    await form.getByRole('button', { name: text.save, exact: true }).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.request().headers()['next-action']).toBeUndefined();
    expect(response.headers()['x-action-revalidated']).toBeUndefined();
    await expect(page.getByText(text.success, { exact: true })).toBeVisible();
    expect(documentLoads).toBe(2);
    expect((await prisma.workingHours.findFirstOrThrow({
      where: { businessId: fixture.business.id, scope: 'BUSINESS', weekday: 0 },
    })).breaks).toEqual([[660, 675], [720, 750]]);

    const reloadedForm = page.getByRole('form', { name: text.title, exact: true });
    const reloadedSunday = reloadedForm.locator('li').filter({
      hasText: text.weekdays.sunday,
    }).first();
    await reloadedSunday.getByRole('button', {
      name: `${text.removeBreak} 1 ${text.weekdays.sunday}`,
      exact: true,
    }).click();
    await reloadedSunday.getByRole('button', {
      name: `${text.removeBreak} 1 ${text.weekdays.sunday}`,
      exact: true,
    }).click();
    const clearedPromise = page.waitForResponse(isWorkingHoursResponse);
    await reloadedForm.getByRole('button', { name: text.save, exact: true }).click();
    expect((await clearedPromise).ok()).toBe(true);
    await expect(page.getByText(text.success, { exact: true })).toBeVisible();
    expect((await prisma.workingHours.findFirstOrThrow({
      where: { businessId: fixture.business.id, scope: 'BUSINESS', weekday: 0 },
    })).breaks).toEqual([]);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('mobile staff schedule rejects overlapping breaks, accepts adjacency and remains tenant scoped', async ({
  page,
  context,
}) => {
  const fixture = await bookingFixture();
  try {
    await prisma.workingHours.create({
      data: {
        scope: 'STAFF',
        staffId: fixture.staff.id,
        weekday: 0,
        startMinute: 600,
        endMinute: 960,
        breaks: [[660, 720], [780, 810]],
      },
    });
    await prisma.workingHours.create({
      data: {
        scope: 'STAFF',
        staffId: fixture.staff.id,
        weekday: 1,
        startMinute: 1080,
        endMinute: 1440,
        breaks: [[1380, 1440]],
      },
    });
    await signIn(context, fixture.business.ownerEmail);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/working-hours?staff=${fixture.staff.id}`);
    const form = page.getByRole('form', { name: text.title, exact: true });
    const sunday = form.locator('li').filter({ hasText: text.weekdays.sunday }).first();
    const monday = form.locator('li').filter({ hasText: text.weekdays.monday }).first();
    await expect(monday.getByLabel(`${text.endAtMidnight} ${text.endLabel}`, {
      exact: true,
    })).toBeChecked();
    await expect(monday.getByLabel(`${text.endAtMidnight} ${text.breakEndLabel}`, {
      exact: true,
    })).toBeChecked();
    await sunday.getByLabel(text.breakStartLabel, { exact: true }).fill('11:00');
    await sunday.getByLabel(text.breakEndLabel, { exact: true }).fill('12:00');
    await sunday.getByLabel(`${text.breakStartLabel} 2`, { exact: true }).fill('11:30');
    await sunday.getByLabel(`${text.breakEndLabel} 2`, { exact: true }).fill('12:30');

    const rejectedPromise = page.waitForResponse(isWorkingHoursResponse);
    await form.getByRole('button', { name: text.save, exact: true }).click();
    const rejected = await rejectedPromise;
    expect(rejected.status()).toBe(400);
    await expect(page.getByText(text.errorBreakOverlap, { exact: true })).toBeVisible();
    expect((await prisma.workingHours.findFirstOrThrow({
      where: { staffId: fixture.staff.id, scope: 'STAFF', weekday: 0 },
    })).breaks).toEqual([[660, 720], [780, 810]]);

    await sunday.getByLabel(`${text.breakStartLabel} 2`, { exact: true }).fill('12:00');
    const savedPromise = page.waitForResponse(isWorkingHoursResponse);
    await form.getByRole('button', { name: text.save, exact: true }).click();
    expect((await savedPromise).ok()).toBe(true);
    await expect(page.getByText(text.success, { exact: true })).toBeVisible();
    expect((await prisma.workingHours.findFirstOrThrow({
      where: { staffId: fixture.staff.id, scope: 'STAFF', weekday: 0 },
    })).breaks).toEqual([[660, 720], [720, 750]]);
    const midnight = await prisma.workingHours.findFirstOrThrow({
      where: { staffId: fixture.staff.id, scope: 'STAFF', weekday: 1 },
    });
    expect(midnight.endMinute).toBe(1440);
    expect(midnight.breaks).toEqual([[1380, 1440]]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanupFixture(fixture);
  }
});
