import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { prisma } from '../src/lib/db';
import { hashOtp } from '../src/lib/crypto';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const channel of ['email', 'phone'] as const) {
  test(`customer ${channel} login: delivery stub, invalid OTP, retry and real account session`, async ({
    page,
    context,
  }, info) => {
    const identity =
      channel === 'email' ? `visual-${randomUUID()}@example.invalid` : '+972507654321';
    const code = '682951';
    await prisma.otpCode.deleteMany({ where: { phone: identity } });
    await prisma.otpCode.create({
      data: {
        phone: identity,
        codeHash: hashOtp(code, identity),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      const requestPath =
        channel === 'email' ? '/api/otp/email/request' : '/api/otp/request';
      await page.route(`**${requestPath}`, (route) =>
        route.fulfill({ json: { ok: true } }),
      );
      await page.goto('/login?next=%2Faccount');
      await page
        .getByRole('button', {
          name: channel === 'email' ? t.auth.methodEmail : t.auth.methodPhone,
          exact: true,
        })
        .click();
      await page.locator(`input[name=${channel}]`).fill(identity);
      await page.locator('form button[type=submit]').click();
      await page.locator('input[name=code]').fill('000000');
      await page.locator('form button[type=submit]').click();
      await expect(page.getByText(t.auth.invalidCode, { exact: true })).toBeVisible();
      await expect(page.locator('input[name=code]')).toBeVisible();
      await expect
        .poll(async () =>
          (await context.cookies()).some((c) => c.name === 'client_session'),
        )
        .toBe(false);
      await page.locator('input[name=code]').fill(code);
      await page.locator('input[name=name]').fill('לקוח בדיקה');
      await page.locator('form button[type=submit]').click();
      await expect(page).toHaveURL((url) => url.pathname === '/account');
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: `${t.account.greeting} לקוח בדיקה`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText(identity, { exact: true })).toBeVisible();
      expect((await context.cookies()).some((c) => c.name === 'client_session')).toBe(
        true,
      );
      await info.attach(`account-${channel}.png`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } finally {
      await prisma.otpCode.deleteMany({ where: { phone: identity } });
      await prisma.user.deleteMany({
        where: channel === 'email' ? { email: identity } : { phone: identity },
      });
    }
  });
}
