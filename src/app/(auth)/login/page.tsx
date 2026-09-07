import { Suspense } from 'react';
import type { Metadata } from 'next';
import { t } from '@/i18n';
import { authProviderStatus } from '@/auth';
import LoginForm from './LoginForm';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({ title: t.auth.phoneTitle, path: '/login', noIndex: true });

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={authProviderStatus.google} />
    </Suspense>
  );
}
