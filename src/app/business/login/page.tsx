import { Suspense } from 'react';
import { auth, authProviderStatus } from '@/auth';
import { redirect } from 'next/navigation';
import { t } from '@/i18n';
import { Container, Section, Card } from '@/components/ui';
import { OwnerSignIn } from './OwnerSignIn';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `${t.business.login.title} · תור צ׳יק`,
};

/**
 * כניסת בעלי עסק (מובחנת מכניסת הלקוח ב-/login).
 * בעל עסק כבר מאומת מנותב מיד ליעד (ברירת מחדל /business/resume).
 * ספקים מגודרים ב-env: מוצג רק מה שמופעל, אחרת הודעת "לא מוגדר".
 */
export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const callbackUrl = redirectTo || '/business/resume';

  const session = await auth();
  if (session?.user?.email) {
    redirect(callbackUrl);
  }

  const anyProvider =
    authProviderStatus.google || authProviderStatus.email || authProviderStatus.firebasePhone;

  return (
    <Section spacing="lg">
      <Container className="max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-sand-900 sm:text-4xl">
            {t.business.login.title}
          </h1>
          <p className="mt-3 text-sand-600">{t.business.login.subtitle}</p>
        </div>

        <Card>
          {anyProvider ? (
            <Suspense>
              <OwnerSignIn
                googleEnabled={authProviderStatus.google}
                emailEnabled={authProviderStatus.email}
                phoneEnabled={authProviderStatus.firebasePhone}
                callbackUrl={callbackUrl}
              />
            </Suspense>
          ) : (
            <p className="text-center text-sm text-sand-600">
              {t.business.login.noProviders}
            </p>
          )}

          <div className="mt-6 border-t border-sand-200 pt-5 text-center text-sm text-sand-600">
            <span>{t.business.login.clientPrompt} </span>
            <a href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
              {t.business.login.clientCta}
            </a>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
