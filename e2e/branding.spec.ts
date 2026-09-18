import { encode } from 'next-auth/jwt';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';
import { themeFromBrandColor } from '../src/lib/branding';
import { t } from '../src/i18n';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`branding saves immediately and settings edits the same full palette at ${width}px`, async ({ page, context }) => {
    const f = await bookingFixture();
    const other = await bookingFixture();
    const original = {
      presentation: 'premium', theme: BRAND_PRESETS[0].theme,
      heroHeadline: 'Existing synthetic business', heroImages: ['/icons/icon-192.png'],
      sections: { highlights: false, socialCta: false }, socialLinks: { whatsapp: '0501234567' },
    };
    const otherLanding = {
      testimonials: [{ name: 'Other tenant', quote: 'Must remain isolated' }],
      googleReviewsUrl: 'https://g.page/r/other-tenant/review',
    };
    try {
      await prisma.business.update({ where: { id: f.business.id }, data: {
        publicPageStyle: 'LANDING', logoUrl: '/icons/icon-192.png',
        landingContent: original, brandColor: original.theme.brand,
      } });
      await prisma.business.update({
        where: { id: other.business.id },
        data: { landingContent: otherLanding },
      });
      await prisma.businessSettings.update({ where: { businessId: f.business.id }, data: { onboardingCompleted: true } });
      const token = await encode({
        token: { email: f.business.ownerEmail }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/admin/onboarding?step=branding');
      const first = BRAND_PRESETS.find(preset => preset.id === 'barber-dark')!;
      const picker = page.getByTestId('brand-palette-picker');
      await picker.getByRole('button', { name: first.name, exact: true }).click();
      await page.locator('form').filter({ has: picker }).locator('button[type=submit]').last().click();
      await expect(page.locator('form.pw-phone')).toBeVisible();
      // Exit before publishing any optional premium step.
      await page.goto('/admin/settings');
      await expect(picker.getByRole('button', { name: first.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      let saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
      expect(saved.landingContent).toEqual({ ...original, theme: first.theme });
      expect(saved.brandColor).toBe(first.theme.brand);
      const second = BRAND_PRESETS.find(preset => preset.id === 'royal-purple')!;
      const announcement = 'Synthetic holiday opening hours';
      const googleReviewsUrl = 'https://share.google/RJsPMrkBplt5Zjx4K';
      const updates = { announcement, googleReviewsUrl };
      await page.getByLabel(t.admin.settings.pageStyle.announcementLabel, { exact: true }).fill(announcement);
      await page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true }).fill(googleReviewsUrl);
      await picker.getByRole('button', { name: second.name, exact: true }).click();
      const rejectedOrigins: Record<string, string>[] = [{}, { origin: 'https://other.example.invalid' }];
      for (const headers of rejectedOrigins) {
        const denied = await context.request.post('/api/admin/settings', { headers, multipart: { name: 'Must not save' } });
        expect(denied.status()).toBe(403);
      }
      const malformed = await context.request.post('/api/admin/settings', {
        headers: { origin: BASE_URL }, data: { name: 'Must not save' },
      });
      expect(malformed.status()).toBe(415);
      await page.route('**/api/admin/settings', route => route.abort('failed'));
      await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
      await expect(page.getByText(t.common.saveUnconfirmed, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t.admin.settings.saveAll, exact: true })).toBeEnabled();
      expect((await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent)
        .toEqual({ ...original, theme: first.theme });
      await page.unroute('**/api/admin/settings');
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/admin/settings'));
      await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
      const response = await responsePromise;
      expect(response.request().headers()['next-action']).toBeUndefined();
      expect(response.headers()['content-type']).toContain('application/json');
      expect(response.headers()['x-action-revalidated']).toBeUndefined();
      await expect(
        page.locator('div[role="status"][aria-live="polite"]').filter({
          hasText: t.admin.settings.savedShort,
        }),
      ).toHaveClass(/opacity-100/);
      expect(await response.json()).toEqual({ ok: true });
      await page.reload();
      await expect(picker.getByRole('button', { name: second.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
      expect(saved.landingContent).toEqual({ ...original, ...updates, theme: second.theme });
      expect(saved.brandColor).toBe(second.theme.brand);
      await expect(page.getByLabel(t.admin.settings.pageStyle.announcementLabel, { exact: true })).toHaveValue(announcement);
      await expect(page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true })).toHaveValue(googleReviewsUrl);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByText(announcement, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: t.publicPage.landing.googleReviewsCta, exact: true }))
        .toHaveCount(0);
      await expect(page.getByRole('link', { name: t.reviews.write, exact: true }))
        .toHaveCount(1);
      await expect.poll(() => page.locator('#lp-book').evaluate(element =>
        getComputedStyle(element).getPropertyValue('--c-brand').trim())).toBe(second.theme.brand);
      await page.goto('/admin/settings');
      await page.getByLabel(t.admin.settings.pageStyle.announcementLabel, { exact: true }).fill('');
      await page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true }).fill('');
      await picker.getByRole('button', { name: '#12b886', exact: true }).click();
      await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
      await expect(
        page.locator('div[role="status"][aria-live="polite"]').filter({
          hasText: t.admin.settings.savedShort,
        }),
      ).toHaveClass(/opacity-100/);
      await page.reload();
      saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
      expect(saved.landingContent).toEqual({ ...original, theme: themeFromBrandColor('#12b886') });
      expect(saved.logoUrl).toBe('/icons/icon-192.png');
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByText(announcement, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: t.publicPage.landing.googleReviewsCta, exact: true })).toHaveCount(0);
      expect((await prisma.business.findUniqueOrThrow({
        where: { id: other.business.id },
      })).landingContent).toEqual(otherLanding);
    } finally {
      await cleanupFixture(f);
      await cleanupFixture(other);
    }
  });
}

test('unchanged legacy Google metadata survives an unrelated mobile settings save', async ({ page, context }) => {
  const f = await bookingFixture();
  const legacyUrl = 'https://legacy.example.invalid/google-profile';
  const original = {
    presentation: 'premium',
    theme: BRAND_PRESETS[0].theme,
    heroHeadline: 'Preserved legacy business',
    heroVideoUrl: '/images/retained-video.mp4',
    googleReviewsUrl: legacyUrl,
  };
  try {
    await prisma.business.update({
      where: { id: f.business.id },
      data: { publicPageStyle: 'LANDING', landingContent: original },
    });
    const token = await encode({
      token: { email: f.business.ownerEmail },
      secret: process.env.AUTH_SECRET!,
      salt: 'authjs.session-token',
    });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/settings');
    await expect(page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true }))
      .toHaveValue(legacyUrl);

    const announcement = 'Only this field changed';
    await page.getByLabel(t.admin.settings.pageStyle.announcementLabel, { exact: true })
      .fill(announcement);
    await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
    await expect(
      page.locator('div[role="status"][aria-live="polite"]').filter({
        hasText: t.admin.settings.savedShort,
      }),
    ).toHaveClass(/opacity-100/);
    await page.reload();
    await expect(page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true }))
      .toHaveValue(legacyUrl);
    expect((await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
    })).landingContent).toEqual({ ...original, announcement });
  } finally {
    await cleanupFixture(f);
  }
});

test('unsafe Google lookalikes show a field-specific error and do not mutate settings', async ({ page, context }) => {
  const f = await bookingFixture();
  try {
    const original = {
      presentation: 'premium',
      theme: BRAND_PRESETS[0].theme,
      heroHeadline: 'Preserved invalid submission fixture',
    };
    await prisma.business.update({
      where: { id: f.business.id },
      data: { publicPageStyle: 'LANDING', landingContent: original },
    });
    const token = await encode({
      token: { email: f.business.ownerEmail },
      secret: process.env.AUTH_SECRET!,
      salt: 'authjs.session-token',
    });
    await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/settings');
    const field = page.getByLabel(t.admin.settings.pageStyle.googleReviewsLabel, { exact: true });
    await field.fill('https://share.google.evil.invalid/RJsPMrkBplt5Zjx4K');
    const responsePromise = page.waitForResponse(response =>
      response.url().endsWith('/api/admin/settings'),
    );
    await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'google_reviews_url' });
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#google-reviews-error')).toHaveText(
      t.admin.settings.pageStyle.googleReviewsError,
    );
    expect((await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
    })).landingContent).toEqual(original);
  } finally {
    await cleanupFixture(f);
  }
});
