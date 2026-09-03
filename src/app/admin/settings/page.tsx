import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getOrCreateSettings } from '@/server/repos/settings';
import { listMessageTemplateOverrides } from '@/server/repos/messageTemplates';
import { canSendPaidClientSms } from '@/server/subscription';
import { getCostGuardStatus } from '@/server/billing/costGuard';
import SettingsForm from './SettingsForm';
import CostGuardPanel from './CostGuardPanel';
import DeleteAccountSection from './DeleteAccountSection';
import CalendarSyncSection from './CalendarSyncSection';

export const metadata: Metadata = { title: t.admin.settings.title };

type Props = {
  searchParams: Promise<{ calendar?: string }>;
};

export default async function AdminSettingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const settings = await getOrCreateSettings(business.id);
  const templateOverrides = await listMessageTemplateOverrides(business.id);
  const isExclusive = canSendPaidClientSms(business);
  const costGuardStatus = isExclusive
    ? await getCostGuardStatus(business.id)
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.settings.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-[#8f8478]">{t.admin.settings.subtitle}</p>
      </header>

      {settings.onboardingCompleted ? null : (
        <Link
          href="/admin/onboarding"
          className="mb-6 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
        >
          <span>{t.admin.settings.onboardingCta}</span>
          <span aria-hidden>←</span>
        </Link>
      )}

      <SettingsForm
        business={business}
        settings={settings}
        templateOverrides={templateOverrides}
        onboardingCompleted={settings.onboardingCompleted}
        isExclusive={isExclusive}
        vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
      />

      <CalendarSyncSection
        business={{ id: business.id, name: business.name, ownerEmail: business.ownerEmail }}
        resultCode={sp.calendar}
      />

      {costGuardStatus ? <CostGuardPanel status={costGuardStatus} /> : null}

      <DeleteAccountSection />
    </main>
  );
}
