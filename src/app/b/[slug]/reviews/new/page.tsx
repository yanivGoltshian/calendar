import Link from 'next/link';
import { notFound } from 'next/navigation';
import { t } from '@/i18n';
import { getClientSession } from '@/lib/session';
import { getBusinessBySlug } from '@/server/repos/business';
import { getReviewSubmissionContext } from '@/server/reviews/submissionContext';
import ReviewSubmissionContent from '@/components/reviews/ReviewSubmissionContent';
import { submitBusinessReviewAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: t.reviews.write,
  robots: { index: false, follow: false },
};

export default async function NewBusinessReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const session = await getClientSession();
  const context = await getReviewSubmissionContext(business, session?.userId);
  const labels = t.reviews;
  const back = `/b/${encodeURIComponent(slug)}#reviews`;
  return (
    <main className="mx-auto max-w-xl px-5 py-8" dir="rtl">
      <Link
        href={back}
        className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold underline"
      >
        {labels.back}
      </Link>
      <header className="mb-6">
        <p className="text-sm text-slate-500">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{labels.customerTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{labels.customerIntro}</p>
      </header>
      <ReviewSubmissionContent
        slug={slug}
        context={context}
        action={submitBusinessReviewAction}
      />
    </main>
  );
}
