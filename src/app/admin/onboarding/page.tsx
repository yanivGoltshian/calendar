import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getOrCreateSettings } from '@/server/repos/settings';
import OnboardingWizard from './OnboardingWizard';

export const metadata: Metadata = { title: t.admin.onboarding.title };

export default async function AdminOnboardingPage() {
  const business = await getActiveBusiness();
  if (!business) notFound();

  const settings = await getOrCreateSettings(business.id);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">{t.admin.onboarding.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.onboarding.subtitle}</p>
      </header>

      {settings.onboardingCompleted ? (
        <p className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {t.admin.onboarding.completedBanner}
        </p>
      ) : null}

      <OnboardingWizard business={business} settings={settings} />
    </main>
  );
}
