import { encode } from 'next-auth/jwt';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { BASE_URL } from './helpers';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { BRAND_PRESETS } from '../src/app/admin/onboarding/premium';
import { normalizeLandingContent, landingDefaults } from '../src/lib/publicPageStyle';
import { HERO_VIDEO } from './visualFixtures';
import { t } from '../src/i18n';
import { DEFAULT_BRAND, getTemplateDef } from '../src/server/messages/registry';
import { formatDateString } from '../src/lib/time';
import { ADMIN_BOTTOM_NAV, ADMIN_MORE_ROWS } from '../src/app/admin/adminNav';

test.afterAll(() => prisma.$disconnect());

for (const width of [390, 1366]) {
  test(`premium publication keeps media and logo after optional skips at ${width}px`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(15_000);
    const f = await bookingFixture();
    const navigationPaths = new Set([...ADMIN_BOTTOM_NAV, ...ADMIN_MORE_ROWS].map(item => item.href).filter(Boolean));
    const navigationPrefetches: string[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.headers()['next-router-prefetch'] === '1' &&
        navigationPaths.has(url.pathname) && !url.searchParams.has('edit')) navigationPrefetches.push(request.url());
    });
    let extraStaffUserId: string | undefined;
    const longServiceName = 'טיפול שעווה (אוזניים/אמצע גבות/אף/עצמות לחיים) עם שם מפורט וארוך לבדיקת תצוגה';
    const original = {
      theme: BRAND_PRESETS.find(preset => preset.id === 'black-gold')!.theme,
      heroImages: ['/icons/icon-192.png'],
      heroVideoUrl: HERO_VIDEO,
      galleryImageUrls: ['/icons/icon-192.png'],
      socialLinks: { instagram: 'https://instagram.com/synthetic' },
    };
    try {
      let longServiceId = '';
      for (let index = 1; index <= 5; index++) {
        const service = await prisma.service.create({ data: {
          businessId: f.business.id, name: index === 5 ? longServiceName : `Synthetic service ${index}`,
          durationMin: 5, priceAgorot: 1000, sortOrder: index,
          staffLinks: { create: { staffId: f.staff.id } },
        } });
        if (index === 5) longServiceId = service.id;
      }
      await prisma.business.update({ where: { id: f.business.id }, data: {
        type: 'BARBERSHOP', plan: 'basic', subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000), paidUntil: null, brandColor: '#3a3a3a',
        publicPageStyle: 'LANDING', logoUrl: null, landingContent: original,
      } });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/b/${f.business.slug}`);
      // Authored media must render even before a logo or completion marker exists.
      await expect(page.locator('header video')).toBeVisible();
      const booking = page.locator('#lp-book');
      await expect(booking.getByText(t.premiumLanding.clinic.booking.treatmentLabel, { exact: true })).toBeVisible();
      await expect(booking.getByRole('button', { name: t.premiumLanding.clinic.booking.staffAny, exact: true })).toHaveCount(0);
      await expect(booking.getByRole('button', { name: f.staff.displayName, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(booking.getByRole('button', { name: t.premiumLanding.clinic.booking.nextMonth, exact: true })).toBeEnabled();
      const longService = booking.getByRole('button', { name: longServiceName, exact: true });
      await expect(longService).toBeVisible();
      const availability = page.waitForRequest(request => request.url().endsWith('/api/availability') &&
        request.method() === 'POST' && request.postDataJSON().serviceIds?.includes(longServiceId));
      await longService.click();
      expect((await availability).postDataJSON().staffId).toBe(f.staff.id);
      await expect(longService).toHaveAttribute('aria-pressed', 'true');
      await expect(booking.locator('a')).toHaveAttribute('href', new RegExp(`service=${longServiceId}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await longService.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(page.locator('header a[href="#lp-services"]').first()).toHaveText(t.publicPage.servicesTitle);
      const date = formatDateString(f.startAt, f.business.timezone);
      const [year, month, day] = date.split('-').map(Number);
      const monthLabel = `${t.premiumLanding.clinic.booking.months[month - 1]} ${year}`;
      if (!await booking.getByText(monthLabel, { exact: true }).isVisible()) {
        await booking.getByRole('button', { name: t.premiumLanding.clinic.booking.nextMonth, exact: true }).click();
      }
      const slotsResponse = page.waitForResponse(response => response.url().endsWith('/api/availability') &&
        response.request().postDataJSON().date === date);
      await booking.getByRole('button', { name: String(day), exact: true }).click();
      const available = await (await slotsResponse).json();
      expect(available.ok).toBe(true);
      expect(available.slots.length).toBeGreaterThan(0);
      await booking.getByRole('button', { name: available.slots[0].label, exact: true }).click();
      await expect(booking.locator('a')).toHaveAttribute('href', new RegExp(`staffId=${f.staff.id}.*date=${date}.*time=`));
      await page.route('**/api/availability', route => route.fulfill({
        status: 400, json: { ok: false, error: 'staff_service_mismatch' },
      }));
      await booking.getByRole('button', { name: f.service.name, exact: true }).click();
      await expect(booking.getByRole('alert')).toContainText(t.premiumLanding.clinic.booking.configurationError);
      await expect(booking.getByText(t.premiumLanding.clinic.booking.noSlots, { exact: true })).toHaveCount(0);
      await page.unroute('**/api/availability');
      await page.route('**/api/availability', route => route.fulfill({ status: 503, body: 'synthetic outage' }));
      await booking.getByRole('button', { name: t.premiumLanding.clinic.booking.retrySlots, exact: true }).click();
      await expect(booking.getByRole('alert')).toContainText(t.premiumLanding.clinic.booking.loadError);
      await page.unroute('**/api/availability');
      await booking.getByRole('button', { name: t.premiumLanding.clinic.booking.retrySlots, exact: true }).click();
      await expect(booking.getByRole('button', { name: available.slots[0].label, exact: true })).toBeVisible();
      const token = await encode({
        token: { email: f.business.ownerEmail }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token',
      });
      await context.addCookies([{ name: 'authjs.session-token', value: token, url: BASE_URL }]);
      await page.goto('/admin/services');
      const addService = page.locator('form').filter({ has: page.locator('input[name=name]') });
      await expect(addService.locator('input[name=staffIds]')).toBeChecked();
      await addService.locator('input[name=name]').fill('Synthetic auto assigned service');
      await addService.locator('input[name=durationMin]').fill('15');
      await addService.locator('input[name=priceShekels]').fill('20');
      await addService.locator('button[type=submit]').click();
      await expect(page.getByText(t.admin.services.successAdded, { exact: true })).toBeVisible();
      await expect(addService.locator('button[type=submit]')).toBeEnabled();
      expect(await prisma.service.count({
        where: { businessId: f.business.id, name: 'Synthetic auto assigned service' },
      })).toBe(1);
      const createdService = await prisma.service.findFirstOrThrow({
        where: { businessId: f.business.id, name: 'Synthetic auto assigned service' },
        include: { staffLinks: true },
      });
      expect(createdService.staffLinks.map(link => link.staffId)).toEqual([f.staff.id]);
      const createdAvailability = await context.request.post('/api/availability', {
        data: { slug: f.business.slug, staffId: f.staff.id, serviceIds: [createdService.id], date },
      });
      expect(createdAvailability.ok()).toBe(true);
      expect((await createdAvailability.json()).slots.length).toBeGreaterThan(0);
      await page.goto('/admin/onboarding?edit=premium');
      await expect(page.locator('form.pw-phone')).toBeVisible();
      await page.locator('.pw-step .pw-tile').first()
        .getByRole('button', { name: t.admin.settings.profile.image.remove, exact: true }).click();
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(0);
      let uploads = 0;
      await page.route('**/api/upload/media', route => route.fulfill({
        json: { url: ++uploads === 1 ? '/icons/icon-192.png' : '/icons/icon-512.png' },
      }));
      const buffer = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#334455' } }).png().toBuffer();
      const file = { name: 'synthetic.png', mimeType: 'image/png', buffer };
      const chooser = page.waitForEvent('filechooser');
      await page.locator('.pw-step .pw-tile').last().click();
      await (await chooser).setFiles(file);
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(1);
      const secondChooser = page.waitForEvent('filechooser');
      await page.locator('.pw-step .pw-tile').last()
        .getByRole('button', { name: t.admin.onboarding.premium.editor.uploadLabel, exact: true }).click();
      await (await secondChooser).setFiles(file);
      await expect(page.locator('.pw-step .pw-tile img')).toHaveCount(2);
      await page.locator('.pw-step .pw-tile').first()
        .getByRole('button', { name: t.admin.settings.profile.image.remove, exact: true }).click();
      await expect(page.locator('.pw-step .pw-tile img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.getByRole('button', { name: t.admin.onboarding.premium.editor.useAsLogo, exact: true }).click();
      await page.locator('.pw-next').click();
      await page.locator('.pw-step input').last().fill('050-123-4567');
      await page.locator('.pw-skip').click(); // Social content is explicitly omitted.
      await page.locator('.pw-skip').click(); // Skipped deals must not materialize preview defaults.
      await expect(page.getByTestId('premium-logo').locator('img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.locator('.pw-next').click();
      await page.locator('.pw-skip').click();
      await expect(page.locator('.pw-preview .pv-why')).toHaveCount(0);
      await page.getByRole('button', { name: t.admin.onboarding.premium.editor.wizard.win.backToEdit }).click();
      await expect(page.locator('.pw-why-fields input').first()).toHaveValue('');
      await page.locator('.pw-next').click();
      await expect(page.locator('.pw-preview .pv-why')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pw-cube')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pv-social')).toHaveCount(0);
      await expect(page.locator('.pw-preview .pv-logo img')).toHaveAttribute('src', '/icons/icon-512.png');
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.presentation).toBe('premium');
      const saved = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id }, include: { settings: true } });
      const content = normalizeLandingContent(saved.landingContent)!;
      expect(saved.logoUrl).toBe('/icons/icon-512.png');
      expect(saved.settings?.onboardingCompleted).toBe(true);
      expect(content.heroVideoUrl).toBe(HERO_VIDEO);
      expect(content.galleryImageUrls).toEqual(['/icons/icon-512.png']);
      expect(content.sections?.highlights).toBe(false);
      expect(content.benefits).toBeUndefined();
      expect(content.socialLinks).toEqual({ whatsapp: '050-123-4567' });
      expect(content.hotDeals).toBeUndefined();
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('header video')).toBeVisible();
      await expect.poll(() => page.locator('header video').evaluate((video: HTMLVideoElement) =>
        !video.paused && video.currentTime > 0 && video.videoWidth > 0)).toBe(true);
      await expect(page.locator('header').getByRole('img', { name: f.business.name, exact: true })).toBeVisible();
      await expect(page.locator('header a[href="#lp-offers"]')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.highlightsTitle, exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.ctaTitle, exact: true })).toHaveCount(0);
      const whatsapp = page.getByRole('link', { name: t.premiumLanding.whatsappAria, exact: true });
      await expect(whatsapp).toBeVisible();
      await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/972501234567');
      expect(await whatsapp.evaluate(element => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return Boolean(hit && element.contains(hit));
      })).toBe(true);
      const logo = page.locator('header img').first();
      await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await info.attach(`published-${width}.png`, { body: await page.screenshot(), contentType: 'image/png' });
      // Reopening preserves exclusion until content is explicitly restored.
      await page.goto('/admin/onboarding?edit=premium');
      await page.locator('.pw-pip').nth(1).click();
      await page.locator('.pw-next').click();
      await page.locator('.pw-pip').nth(4).click();
      await expect(page.locator('.pw-why-fields input').first()).toHaveValue('');
      await page.getByRole('button', { name: t.admin.onboarding.premium.editor.wizard.why.restoreDefaults, exact: true }).click();
      await page.locator('.pw-next').click();
      await expect(page.locator('.pw-preview .pv-why')).toBeVisible();
      await expect(page.locator('.pw-preview .pv-social')).toHaveCount(0);
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.sections?.highlights).toBe(true);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.highlightsTitle, exact: true })).toBeVisible();
      await expect(page.getByText(landingDefaults('BARBERSHOP').benefits[0].title, { exact: true })).toBeVisible();
      await page.goto('/admin/onboarding?edit=premium');
      await page.locator('.pw-pip').nth(3).click();
      await page.locator('.pw-skip').click();
      await page.locator('.pw-next').click();
      await expect(page.locator('.pw-preview .pv-hero p')).toBeEmpty();
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.sections?.hero).toBe(false);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.locator('header video')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.business.name);
      await expect(page.getByText(landingDefaults('BARBERSHOP').heroSubtext, { exact: true })).toHaveCount(0);
      expect(navigationPrefetches).toEqual([]);
      await expect(page.locator('header a[href="#lp-location"]')).toHaveCount(0);
      await page.goto('/admin/onboarding?edit=premium');
      await page.locator('.pw-pip').nth(4).click();
      await page.locator('.pw-skip').click();
      await page.locator('.pw-publish').click();
      await expect.poll(async () => normalizeLandingContent(
        (await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } })).landingContent,
      )?.sections?.highlights).toBe(false);
      await page.goto('/admin/settings');
      const adminLogos = page.locator('.admin-shell .logo img');
      await expect(adminLogos).toHaveCount(2);
      for (const image of await adminLogos.all()) {
        await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0)).toBe(true);
      }
      await expect(page.locator('link[rel=icon]').last()).toHaveAttribute('href', /\/icon\?size=192&v=[a-f0-9]{16}$/);
      const message = page.getByTestId('message-template-booking_confirmation-email');
      const preview = message.getByTestId('message-preview');
      await expect(preview).toContainText(f.business.name);
      await expect(preview).toContainText(DEFAULT_BRAND);
      await expect(preview).not.toContainText('{{');
      await message.locator('summary').click();
      const subject = message.locator('input[name$=".subject"]');
      await subject.fill('Preview {{businessName}}');
      await expect(preview).toContainText(`Preview ${f.business.name}`);
      await expect(subject).toHaveValue('Preview {{businessName}}');
      await message.getByRole('button', { name: t.admin.settings.messageTemplates.reset, exact: true }).click();
      await expect(subject).toHaveValue(getTemplateDef('booking_confirmation').channels.email!.subject!);
      await expect(preview).toContainText(DEFAULT_BRAND);
      const extraStaffUser = await prisma.user.create({ data: { email: `${f.business.slug}-staff@example.invalid` } });
      extraStaffUserId = extraStaffUser.id;
      await prisma.staffMember.create({ data: {
        businessId: f.business.id, userId: extraStaffUser.id, displayName: 'Second synthetic staff',
      } });
      // A real settings save preserves exclusions and invalidates the cached public page.
      await page.locator('input[name=phone]').fill('050-111-2222');
      await page.getByRole('button', { name: t.admin.settings.saveAll, exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: t.admin.settings.savedShort })).toHaveClass(/opacity-100/);
      await page.goto(`/b/${f.business.slug}`);
      await expect(page.getByRole('heading', { name: t.publicPage.landing.highlightsTitle, exact: true })).toHaveCount(0);
      await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/972501234567');
      await expect(booking.getByRole('button', { name: t.premiumLanding.clinic.booking.staffAny, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(booking.getByRole('button', { name: 'Second synthetic staff', exact: true })).toBeVisible();
    } finally {
      await cleanupFixture(f);
      if (extraStaffUserId) await prisma.user.delete({ where: { id: extraStaffUserId } });
    }
  });
}
