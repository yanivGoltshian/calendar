import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { bookingUrl } from '@/lib/booking-link';
import { bookingQrSvg } from '@/lib/qr-svg';
import LandingOnboardingWizard from './LandingOnboardingWizard';
import type { PublicPageValues } from '../../settings/fields';

export const metadata: Metadata = { title: t.admin.onboarding.landing.title };

export default async function LandingOnboardingPage() {
  const business = await getActiveBusiness();
  if (!business) notFound();

  const link = bookingUrl(business.slug);
  const qr = bookingQrSvg(link, {
    label: t.admin.onboarding.goLive.share.qrAlt.replace('{name}', business.name),
  });

  const b: PublicPageValues = {
    type: business.type,
    publicPageStyle: business.publicPageStyle,
    landingContent: business.landingContent,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">{t.admin.onboarding.landing.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.onboarding.landing.subtitle}</p>
      </header>

      <LandingOnboardingWizard
        b={b}
        businessName={business.name}
        brandColor={business.brandColor ?? ''}
        shareUrl={link}
        shareQr={qr}
      />
    </main>
  );
}
