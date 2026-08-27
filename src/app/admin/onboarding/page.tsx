import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getOrCreateSettings } from '@/server/repos/settings';
import { listServices } from '@/server/repos/services';
import { getServiceTemplate } from '@/server/onboarding/serviceTemplates';
import { bookingUrl } from '@/lib/booking-link';
import { bookingQrSvg } from '@/lib/qr-svg';
import { normalizeLandingContent } from '@/lib/publicPageStyle';
import OnboardingWizard, { type WizardService } from './OnboardingWizard';

export const metadata: Metadata = { title: t.admin.onboarding.title };

/**
 * ‎?edit=premium‎ (או ‎?phase=editor‎) פותח את האשף ישר בעורך עמוד הפרימיום —
 * קיצור בלחיצה אחת לעריכת העמוד, למשל מיד אחרי «כניסה כבעל העסק». ב-Next 15
 * ‎searchParams‎ הוא Promise ולכן נדרש await.
 */
type Props = {
  searchParams: Promise<{ edit?: string; phase?: string }>;
};

export default async function AdminOnboardingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialPremiumPhase = sp.edit === 'premium' || sp.phase === 'editor' ? 'editor' : undefined;

  const business = await getActiveBusiness();
  if (!business) notFound();

  const settings = await getOrCreateSettings(business.id);
  const services = await listServices(business.id);

  const link = bookingUrl(business.slug);
  const qr = bookingQrSvg(link, {
    label: t.admin.onboarding.goLive.share.qrAlt.replace('{name}', business.name),
  });

  const wizardServices: WizardService[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    priceAgorot: s.priceAgorot,
    hidden: s.hidden,
  }));

  // דוגמת פלייסהולדר מותאמת לסוג העסק (למשל "אימון אישי" לעסק כושר).
  const serviceExample = getServiceTemplate(business.type)[0]?.name ?? '';

  // תוכן פרימיום קיים (אם כבר מולא) — מנורמל לזריעת האשף בכניסה חוזרת.
  const premiumInitial = normalizeLandingContent(business.landingContent);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">{t.admin.onboarding.title}</h1>
        <p className="mt-1 text-sm text-[#8f8478]">{t.admin.onboarding.subtitle}</p>
      </header>

      {settings.onboardingCompleted ? (
        <p className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {t.admin.onboarding.completedBanner}
        </p>
      ) : null}

      <OnboardingWizard
        businessName={business.name}
        brandColor={business.brandColor ?? ''}
        logoUrl={business.logoUrl ?? ''}
        services={wizardServices}
        serviceExample={serviceExample}
        bookingUrl={link}
        bookingQr={qr}
        businessType={business.type ?? ''}
        businessAddress={business.address ?? ''}
        slug={business.slug}
        premiumInitial={premiumInitial}
        initialPremiumPhase={initialPremiumPhase}
      />
    </main>
  );
}
