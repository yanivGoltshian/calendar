import { createHash, createHmac, randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { createAppointment } from '../src/server/repos/appointments';
import { t } from '../src/i18n';
import sharp from 'sharp';
import { HERO_VIDEO } from './visualFixtures';

test.afterAll(() => prisma.$disconnect());

test('verified customer cancellation persists atomically and cancels reminder intent', async ({
  context,
  page,
}, info) => {
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
    await info.attach('customer-account.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
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

test('owner OTP, uploads, sequential onboarding, editor playback and publication', async ({
  context,
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
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
  // Stub delivery only; verify the seeded OTP through the real auth callback.
  await page.route('**/api/otp/email/request', (route) => {
    expect(route.request().postDataJSON().email).toBe(email);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/business/login?redirect=%2Fbusiness%2Fnew');
  await page.locator('input[type=email]').fill(email);
  await page
    .getByRole('button', { name: t.business.login.emailSubmit, exact: true })
    .click();
  await page.locator('input[name=code]').fill(code);
  await page.locator('form:has(input[name=code]) button[type=submit]').click();
  await expect(page).toHaveURL(/\/business\/new$/);
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
  const image = await sharp({
    create: { width: 200, height: 160, channels: 3, background: '#317575' },
  })
    .png()
    .toBuffer();
  let uploadAttempts = 0;
  await page.route('**/api/upload/media', (route) => {
    uploadAttempts++;
    return uploadAttempts === 1
      ? route.fulfill({ status: 503, json: { error: 'תקלה מלאכותית בהעלאה' } })
      : route.fulfill({ json: { url: '/icons/icon-192.png' } });
  });
  await page
    .locator('input[type=file][accept^="image"]')
    .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: image });
  await expect(page.locator('canvas')).toBeVisible();
  await page
    .getByRole('button', { name: t.admin.onboarding.branding.finishCta, exact: true })
    .click();
  await expect(
    page.getByText('יש לסיים או לבטל את התאמת התמונה לפני שמירה.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: t.admin.settings.profile.image.cancel, exact: true })
    .click();
  await page
    .locator('input[type=file][accept^="image"]')
    .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: image });
  await page.locator('input[type=range]').fill('1.5');
  await page
    .getByRole('button', { name: t.admin.settings.profile.image.done, exact: true })
    .click();
  await expect(page.getByText('תקלה מלאכותית בהעלאה')).toBeVisible();
  await page
    .getByRole('button', { name: t.admin.settings.profile.image.done, exact: true })
    .click();
  await expect(page.locator('input[name=logoUrl]')).toHaveValue('/icons/icon-192.png');
  expect(uploadAttempts).toBe(2);
  await info.attach('branding-upload.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
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
  await page
    .getByRole('button', {
      name: t.admin.onboarding.premium.editor.wizard.about.bgImgvid,
      exact: true,
    })
    .click();
  await page.route('**/api/upload/hero-video', (route) =>
    route.fulfill({ json: { url: HERO_VIDEO } }),
  );
  await page
    .locator('input[type=file][accept^="video"]')
    .setInputFiles('e2e/assets/hero-portrait.mp4');
  await expect(page.getByText(HERO_VIDEO, { exact: true })).toBeVisible();
  await page.locator('.pw-next').click();
  await page.locator('.pw-next').click();
  await expect
    .poll(() =>
      page
        .locator('.pw-preview video')
        .evaluate(
          (v: HTMLVideoElement) =>
            !v.paused && v.currentTime > 0.1 && !v.controls && v.videoWidth === 180,
        ),
    )
    .toBe(true);
  await info.attach('editor-preview.png', {
    body: await page.locator('.pw-preview').screenshot(),
    contentType: 'image/png',
  });
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
  await expect
    .poll(() =>
      page
        .locator('header video')
        .evaluate(
          (v: HTMLVideoElement) =>
            !v.paused && v.currentTime > 0.1 && getComputedStyle(v).objectFit === 'cover',
        ),
    )
    .toBe(true);
  await info.attach('newly-published.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/business\/login/);
  await page.getByRole('button', { name: 'תפריט', exact: true }).click();
  const settings = page.locator('a[href="/admin/settings"]:visible').first();
  await settings.click();
  await expect(page).toHaveURL(/\/admin\/settings/);
  expect(
    (await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).logoUrl,
  ).toBe('/icons/icon-192.png');
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
