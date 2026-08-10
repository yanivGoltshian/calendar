import type { Metadata } from 'next';
import { t } from '@/i18n';
import StubModule from '../_components/StubModule';

export const metadata: Metadata = { title: t.admin.nav.onboarding };

export default function AdminOnboardingPage() {
  return <StubModule title={t.admin.nav.onboarding} />;
}
