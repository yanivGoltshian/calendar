import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, authProviderStatus } from '@/auth';
import { t } from '@/i18n';
import { Container, Section, Card, Button } from '@/components/ui';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { decideNewBusinessView } from '../ownerRouting';
import { switchIdentityForAnotherBusiness } from './switch-identity-actions';
import { CreateBusinessForm } from './CreateBusinessForm';
import { OwnerSignIn } from '../login/OwnerSignIn';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `${t.business.start.title} · תור צ׳יק`,
};

/**
 * פתיחת עסק חדש (אפיק D1) כמשפך חמים בדומה ל-calmark:
 * אורח שלחץ "התחל" רואה כאן צעד זהות אינליין (Google) עם הסבר קצר,
 * בלי הפניה לקיר כניסה. לאחר ההתחברות הוא חוזר לכאן ורואה את טופס פרטי העסק.
 */
export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ another?: string }>;
}) {
  const { another } = await searchParams;
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    const anyProvider =
      authProviderStatus.google || authProviderStatus.email || authProviderStatus.firebasePhone;
    return (
      <Section spacing="lg">
        <Container className="max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-sand-900 sm:text-4xl">
              {t.business.start.title}
            </h1>
            <p className="mt-3 text-sand-600">{t.business.start.subtitle}</p>
          </div>

          <Card>
            <ol className="mb-6 space-y-3 text-sm text-sand-700">
              {[t.business.start.step1, t.business.start.step2, t.business.start.step3].map(
                (step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ),
              )}
            </ol>

            {anyProvider ? (
              <Suspense>
                <OwnerSignIn
                  googleEnabled={authProviderStatus.google}
                  emailEnabled={authProviderStatus.email}
                  phoneEnabled={authProviderStatus.firebasePhone}
                  callbackUrl="/business/new"
                />
              </Suspense>
            ) : (
              <p className="text-center text-sm text-sand-600">{t.business.start.noProviders}</p>
            )}

            <div className="mt-6 border-t border-sand-200 pt-5 text-center text-sm text-sand-600">
              <span>{t.business.start.haveBusinessPrompt} </span>
              <Link
                href="/business/login"
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                {t.business.start.haveBusinessCta}
              </Link>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-sand-500">
            <Link href="/" className="hover:text-sand-700">
              {t.business.start.backHome}
            </Link>
          </p>
        </Container>
      </Section>
    );
  }

  const owned = await getBusinessesOwnedByEmail(email);
  const view = decideNewBusinessView({ email, ownedCount: owned.length, another: another === '1' });

  // בעלים מחובר שכבר מנהל עסק, בלי בקשה מפורשת לעסק נוסף: לעולם לא לטופס ההקמה,
  // אלא ישירות לאזור הניהול הקיים. מכסה את כל נקודות הכניסה (hero/תמחור/סיום/סימניה).
  if (view === 'redirect-admin') {
    redirect('/admin');
  }

  // בעלים מחובר שביקש במפורש עסק נוסף (another=1): לא יוצרים עסק שני תחת אותה
  // זהות (זה היה מנתק את העסק הראשון). מציגים מסך שמסביר שצריך זהות אחרת
  // ומאפשר להתנתק ולהיכנס בחשבון Google אחר או בטלפון אחר.
  if (view === 'another-identity') {
    return (
      <Section spacing="lg">
        <Container className="max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-sand-900 sm:text-4xl">
              {t.business.another.title}
            </h1>
            <p className="mt-3 text-sand-600">{t.business.another.subtitle}</p>
          </div>

          <Card>
            <p className="text-sm text-sand-600">
              {t.business.another.currentlySignedInAs}{' '}
              <span className="font-semibold text-sand-800">{email}</span>
            </p>

            <form action={switchIdentityForAnotherBusiness} className="mt-5">
              <Button type="submit" className="w-full">
                {t.business.another.switchIdentity}
              </Button>
            </form>

            <div className="mt-6 border-t border-sand-200 pt-5 text-center text-sm text-sand-600">
              <Link href="/admin" className="font-semibold text-brand-700 hover:text-brand-800">
                {t.business.another.toAdmin}
              </Link>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-sand-500">
            <Link href="/" className="hover:text-sand-700">
              {t.business.start.backHome}
            </Link>
          </p>
        </Container>
      </Section>
    );
  }

  return (
    <Section spacing="lg">
      <Container className="max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-sand-900 sm:text-4xl">
            {t.business.create.title}
          </h1>
          <p className="mt-3 text-sand-600">{t.business.create.subtitle}</p>
          <p className="mt-2 text-sm text-sand-500">
            {t.business.create.signedInAs} {email}
          </p>
        </div>
        <CreateBusinessForm />
      </Container>
    </Section>
  );
}
