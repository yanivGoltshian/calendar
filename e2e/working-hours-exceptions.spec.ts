import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { createAppointment } from '../src/server/repos/appointments';
import { addDaysToDateString, formatDateString } from '../src/lib/time';
import { t } from '../src/i18n';

const text = t.admin.hoursExceptions;
test.afterAll(() => prisma.$disconnect());

test('owner creates a closure, sees preserved booking conflicts, and deletes it in the browser', async ({ page, context }) => {
  const f = await bookingFixture();
  try {
    const appointment = await createAppointment({ ...f.input, status: 'PENDING' });
    const token = await encode({ token: { email: f.business.ownerEmail },
      secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
    await page.goto('/admin/working-hours');
    const form = page.getByRole('form', { name: text.add });
    await form.getByLabel(text.name, { exact: true }).fill('Holiday browser closure');
    await form.getByLabel(text.startDate, { exact: true }).fill(formatDateString(f.startAt, f.business.timezone));
    await form.getByRole('button', { name: text.save, exact: true }).click();
    await expect(form.getByRole('button', { name: text.save, exact: true })).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: text.conflicts, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `${text.remove} Holiday browser closure`, exact: true })).toBeVisible();
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe('PENDING');
    const response = await page.request.post('/api/availability', { data: {
      slug: f.business.slug, staffId: f.staff.id, serviceIds: [f.service.id],
      date: formatDateString(f.startAt, f.business.timezone),
    } });
    expect((await response.json()).slots).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('closure-conflict.png'), fullPage: true });
    await page.getByRole('button', { name: `${text.remove} Holiday browser closure`, exact: true }).click();
    await expect(page.getByText(text.empty, { exact: true })).toBeVisible();
    expect(await prisma.workingHoursException.count({ where: { businessId: f.business.id } })).toBe(0);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).startAt).toEqual(appointment.startAt);
  } finally { await cleanupFixture(f); }
});

test('mobile owner configures employee fortnightly hours and Hebrew/Gregorian annual dates with invalid-date feedback', async ({ page, context }) => {
  const f = await bookingFixture();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const token = await encode({ token: { email: f.business.ownerEmail },
      secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
    await page.goto(`/admin/working-hours?staff=${f.staff.id}`);
    const form = page.getByRole('form', { name: text.add });
    const date = formatDateString(f.startAt, f.business.timezone);
    await form.getByLabel(text.name, { exact: true }).fill('Fortnightly employee');
    await form.getByLabel(text.recurrence, { exact: true }).selectOption('WEEKLY');
    await form.getByLabel(text.startDate, { exact: true }).fill(date);
    await form.getByLabel(text.interval, { exact: false }).fill('2');
    await form.getByLabel(text.closed, { exact: true }).uncheck();
    await form.getByLabel(t.admin.workingHours.startLabel, { exact: true }).fill('11:00');
    await form.getByLabel(t.admin.workingHours.endLabel, { exact: true }).fill('14:00');
    await form.getByRole('button', { name: text.save, exact: true }).click();
    await expect(page.getByRole('button', { name: `${text.remove} Fortnightly employee`, exact: true })).toBeVisible();
    const fortnightly = await prisma.workingHoursException.findFirstOrThrow({ where: { businessId: f.business.id } });
    expect(fortnightly.staffId).toBe(f.staff.id);
    expect(fortnightly.intervalWeeks).toBe(2);
    for (const [offset, first] of [[0, '11:00'], [7, '09:00'], [14, '11:00']] as const) {
      const response = await page.request.post('/api/availability', { data: {
        slug: f.business.slug, staffId: f.staff.id, serviceIds: [f.service.id], date: addDaysToDateString(date, offset),
      } });
      expect((await response.json()).slots[0].label).toBe(first);
    }
    await form.getByLabel(text.name, { exact: true }).fill('Annual Gregorian');
    await form.getByLabel(text.recurrence, { exact: true }).selectOption('ANNUAL');
    await form.getByLabel(text.closed, { exact: true }).check();
    await form.getByLabel(text.startDate, { exact: true }).fill(date);
    await form.getByRole('button', { name: text.save, exact: true }).click();
    await expect(page.getByRole('button', { name: `${text.remove} Annual Gregorian`, exact: true })).toBeVisible();
    await form.getByLabel(text.name, { exact: true }).fill('Rosh Hashanah');
    await form.getByLabel(text.calendar, { exact: true }).selectOption('HEBREW');
    await form.getByLabel(text.scope, { exact: true }).selectOption('');
    await form.getByLabel(`${text.startDate} ${text.year}`, { exact: true }).fill('5788');
    await form.getByLabel(`${text.startDate} ${text.month}`, { exact: true }).selectOption('ADAR_I');
    await form.getByLabel(`${text.startDate} ${text.day}`, { exact: true }).fill('1');
    await form.getByRole('button', { name: text.save, exact: true }).click();
    await expect(form.getByRole('alert')).toHaveText(text.errors.invalid);
    await expect(form.getByLabel(text.calendar, { exact: true })).toHaveValue('HEBREW');
    await expect(form.getByLabel(text.recurrence, { exact: true })).toHaveValue('ANNUAL');
    await expect(form.getByLabel(text.scope, { exact: true })).toHaveValue('');
    await form.getByLabel(text.name, { exact: true }).fill('Rosh Hashanah');
    await form.getByLabel(`${text.startDate} ${text.year}`, { exact: true }).fill('5787');
    await form.getByLabel(`${text.startDate} ${text.month}`, { exact: true }).selectOption('TISHRI');
    await form.getByLabel(`${text.startDate} ${text.day}`, { exact: true }).fill('1');
    await form.getByRole('button', { name: text.save, exact: true }).click();
    await expect(page.getByRole('button', { name: `${text.remove} Rosh Hashanah`, exact: true })).toBeVisible();
    const hebrew = await prisma.workingHoursException.findFirstOrThrow({ where: { businessId: f.business.id, title: 'Rosh Hashanah' } });
    expect(hebrew.startDate).toBe('2026-09-12');
    expect(hebrew.annualMonth).toBe('TISHRI');
    expect(hebrew.staffId).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('hebrew-mobile.png'), fullPage: true });
  } finally { await cleanupFixture(f); }
});
