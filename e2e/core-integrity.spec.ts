import { createHash, createHmac, randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { createAppointment } from '../src/server/repos/appointments';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

test('verified customer cancellation persists atomically and cancels reminder intent', async ({
  context,
  page,
}) => {
  const f = await bookingFixture();
  const email = `${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({
    data: { email, emailVerified: new Date(), name: 'Verified synthetic customer' },
  });
  try {
    await prisma.client.update({
      where: { id: f.client.id },
      data: { userId: user.id, email, identityVerifiedAt: new Date() },
    });
    const appointment = await createAppointment(f.input);
    const payload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        email,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', process.env.SESSION_SECRET!)
      .update(payload)
      .digest('base64url');
    await context.addCookies([
      {
        name: 'client_session',
        value: `${payload}.${signature}`,
        url: BASE_URL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/account');
    await page.getByRole('button', { name: t.account.cancelCta, exact: true }).click();
    await page
      .getByRole('button', { name: t.account.cancelConfirm, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } }))
            .status,
      )
      .toBe('CANCELLED');
    expect(
      (await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } }))
        .cancelledBy,
    ).toBe('CLIENT');
    expect(
      await prisma.reminder.count({
        where: { appointmentId: appointment.id, status: 'SCHEDULED' },
      }),
    ).toBe(0);
  } finally {
    await cleanupFixture(f);
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('owner OTP, creation, sequential onboarding and publication require no navigation workaround', async ({
  context,
  page,
}) => {
  const email = `${randomUUID()}@example.invalid`;
  const code = '654321';
  await prisma.otpCode.create({
    data: {
      phone: email,
      codeHash: createHash('sha256')
        .update(`${email}:${code}:${process.env.OTP_PEPPER}`)
        .digest('hex'),
      expiresAt: new Date(Date.now() + 300_000),
    },
  });
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  const login = await context.request.post('/api/auth/callback/owner-email', {
    form: {
      csrfToken: csrf.csrfToken,
      email,
      code,
      callbackUrl: `${BASE_URL}/business/new`,
    },
    headers: { 'X-Auth-Return-Redirect': '1' },
  });
  expect(login.ok()).toBeTruthy();
  expect((await (await context.request.get('/api/auth/session')).json()).user.email).toBe(
    email,
  );
  expect(
    (
      await context.request.post('/api/push/subscribe', {
        data: {
          endpoint: 'https://push.example.invalid/unowned',
          keys: { p256dh: 'synthetic', auth: 'synthetic' },
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto('/business/new');
  await page.locator('input[name=name]').fill('Synthetic published clinic');
  await page
    .getByRole('button', { name: t.admin.settings.types.CLINIC, exact: true })
    .click();
  await page.getByRole('button', { name: t.business.create.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/onboarding/);
  const business = await prisma.business.findFirstOrThrow({
    where: { ownerEmail: email },
    include: { services: true, staff: true, workingHours: true },
  });
  expect(business.services.length).toBeGreaterThan(0);
  expect(business.staff.length).toBeGreaterThan(0);
  expect(business.workingHours.length).toBeGreaterThan(0);
  expect(business.trialEndsAt!.getTime()).toBeGreaterThan(Date.now());
  await page
    .locator('form')
    .filter({ has: page.locator('input[name^="svc:"]') })
    .getByRole('button', { name: /אישור|המשך/ })
    .last()
    .click();
  await expect(page.locator('input[name=preset]').first()).toBeAttached();
  await page
    .getByRole('button', { name: t.admin.onboarding.hours.continueCta, exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: t.admin.onboarding.branding.finishCta,
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('button[aria-pressed]').first().click();
  await page
    .getByRole('button', { name: t.admin.onboarding.branding.finishCta, exact: true })
    .click();
  await expect(page.locator('form.pw-phone')).toBeVisible();
  for (let step = 1; step < 4; step++) await page.locator('.pw-next').click();
  await page
    .locator('.pw-field')
    .filter({ hasText: t.admin.onboarding.premium.editor.wizard.about.headlineLabel })
    .locator('input')
    .fill('Synthetic published welcome');
  await page.locator('.pw-next').click();
  await page.locator('.pw-next').click();
  await page.locator('form.pw-phone button[type=submit]').click();
  await expect
    .poll(
      async () =>
        (
          await prisma.businessSettings.findUniqueOrThrow({
            where: { businessId: business.id },
          })
        ).onboardingCompleted,
    )
    .toBe(true);
  const result = await page.goto(`/b/${business.slug}`);
  expect(result!.status()).toBe(200);
  await expect(page.locator(`a[href="/b/${business.slug}/book"]`).first()).toBeVisible();
});

test('anonymous admin mutation APIs fail closed for valid shaped requests', async ({
  request,
}) => {
  const subscriptions = await request.post('/api/push/subscribe', {
    data: {
      endpoint: 'https://push.example.invalid/synthetic',
      keys: { p256dh: 'synthetic', auth: 'synthetic' },
    },
  });
  expect([401, 403]).toContain(subscriptions.status());
  const upload = await request.post('/api/upload/media', {
    multipart: {
      file: {
        name: 'synthetic.png',
        mimeType: 'image/png',
        buffer: Buffer.from('synthetic'),
      },
    },
  });
  expect([401, 403]).toContain(upload.status());
});
