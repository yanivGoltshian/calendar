import { randomUUID, createHash } from 'node:crypto';
import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { computeTrialHashes } from '../src/server/repos/trialLedger';
import { ownerEmailForPhone } from '../src/lib/ownerPhoneIdentity';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

test('superadmin prepares a business and both owner identities resume the same onboarding', async ({ page, context }) => {
  const email = `prepared-${randomUUID()}@example.invalid`;
  const phone = '+972509004101';
  const adminEmail = process.env.PLATFORM_ADMIN_EMAILS ?? 'yanivgolt@gmail.com';
  const token = await encode({ token: { email: adminEmail }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
  await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
  try {
    await page.goto('/superadmin');
    await page.getByRole('button', { name: t.billing.superadmin.create.title, exact: true }).click();
    const form = page.locator('#new-customer-form');
    await form.getByLabel(t.billing.superadmin.create.name, { exact: true }).fill('Prepared customer');
    await form.getByLabel(t.billing.superadmin.create.type, { exact: true }).selectOption('BARBERSHOP');
    await form.getByLabel(t.billing.superadmin.create.phone, { exact: true }).fill(phone);
    await form.getByLabel(t.billing.superadmin.create.email, { exact: true }).fill(email);
    await form.getByRole('button', { name: t.billing.superadmin.create.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding/);
    const prepared = await prisma.business.findFirstOrThrow({ where: { ownerEmail: email }, include: { settings: true } });
    expect(prepared.ownerPhoneIdentity).toBe(ownerEmailForPhone(phone));
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBeNull();
    expect(await prisma.otpCode.count({ where: { phone: email } })).toBe(0);
    expect((await context.cookies()).some((cookie) => cookie.name === 'tc_imp')).toBe(true);
    await context.clearCookies();
    const code = '654321';
    await prisma.otpCode.create({ data: {
      phone: email, codeHash: createHash('sha256').update(`${email}:${code}:${process.env.OTP_PEPPER}`).digest('hex'),
      expiresAt: new Date(Date.now() + 300000),
    } });
    await page.route('**/api/otp/email/request', (route) => route.fulfill({ json: { ok: true } }));
    await page.goto('/business/login?redirect=%2Fbusiness%2Fnew');
    await page.locator('input[type=email]').fill(email);
    await page.getByRole('button', { name: t.business.login.emailSubmit, exact: true }).click();
    await page.locator('input[name=code]').fill(code);
    await page.locator('form:has(input[name=code]) button[type=submit]').click();
    await expect(page).toHaveURL(/\/admin(?:\/onboarding)?$/);
    expect(await prisma.business.count({ where: { ownerEmail: email } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).not.toBeNull();
    await context.clearCookies();
    const phoneToken = await encode({ token: { email: ownerEmailForPhone(phone) }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
    await context.addCookies([{ name: 'authjs.session-token', value: phoneToken, url: BASE_URL }]);
    await page.goto('/business/new');
    await expect(page).toHaveURL(/\/admin(?:\/onboarding)?$/);
    await page.goto(`/b/${prepared.slug}/admin`);
    await expect(page).toHaveURL(/\/admin(?:\/onboarding)?$/);
    expect(await prisma.business.count({ where: { ownerEmail: email } })).toBe(1);
  } finally {
    await prisma.business.deleteMany({ where: { ownerEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.otpCode.deleteMany({ where: { phone: email } });
    await prisma.trialLedger.deleteMany({ where: { emailHash: computeTrialHashes(email, null).emailHash } });
  }
});
