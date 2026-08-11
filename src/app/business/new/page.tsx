import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { t } from '@/i18n';
import { Container, Section } from '@/components/ui';
import { CreateBusinessForm } from './CreateBusinessForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `${t.business.create.title} · תור צ׳יק`,
};

/**
 * הקמת עסק חדש (אפיק D1). העמוד מגדר את עצמו:
 * בעל עסק לא מאומת מנותב לכניסת בעלים ואז חזרה לכאן; מאומת רואה את הטופס.
 */
export default async function NewBusinessPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect('/business/login?redirect=/business/new');
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
