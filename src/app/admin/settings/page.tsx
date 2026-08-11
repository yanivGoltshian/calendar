import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getOrCreateSettings } from '@/server/repos/settings';
import SettingsSection from './SettingsSection';
import {
  ProfileFields,
  PolicyFields,
  TransparencyFields,
  TextsFields,
  RemindersFields,
} from './fields';
import {
  saveProfileAction,
  savePolicyAction,
  saveTransparencyAction,
  saveTextsAction,
  saveRemindersAction,
} from './actions';

export const metadata: Metadata = { title: t.admin.settings.title };

export default async function AdminSettingsPage() {
  const business = await getActiveBusiness();
  if (!business) notFound();

  const settings = await getOrCreateSettings(business.id);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.settings.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.settings.subtitle}</p>
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

      <div className="space-y-6">
        <SettingsSection
          title={t.admin.settings.profile.title}
          description={t.admin.settings.profile.description}
          action={saveProfileAction}
        >
          <ProfileFields b={business} />
        </SettingsSection>

        <SettingsSection
          title={t.admin.settings.policy.title}
          description={t.admin.settings.policy.description}
          action={savePolicyAction}
        >
          <PolicyFields s={settings} />
        </SettingsSection>

        <SettingsSection
          title={t.admin.settings.transparency.title}
          description={t.admin.settings.transparency.description}
          action={saveTransparencyAction}
        >
          <TransparencyFields s={settings} />
        </SettingsSection>

        <SettingsSection
          title={t.admin.settings.texts.title}
          description={t.admin.settings.texts.description}
          action={saveTextsAction}
        >
          <TextsFields s={settings} />
        </SettingsSection>

        <SettingsSection
          title={t.admin.settings.reminders.title}
          description={t.admin.settings.reminders.description}
          action={saveRemindersAction}
        >
          <RemindersFields s={settings} />
        </SettingsSection>
      </div>
    </main>
  );
}
