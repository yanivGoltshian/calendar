import type { Metadata } from 'next';
import { t } from '@/i18n';
import StubModule from '../_components/StubModule';

export const metadata: Metadata = { title: t.admin.nav.appointments };

export default function AdminAppointmentsPage() {
  return <StubModule title={t.admin.nav.appointments} />;
}
