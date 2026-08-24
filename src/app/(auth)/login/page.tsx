import { Suspense } from 'react';
import type { Metadata } from 'next';
import { t } from '@/i18n';
import { authProviderStatus } from '@/auth';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: t.auth.phoneTitle };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={authProviderStatus.google} />
    </Suspense>
  );
}
