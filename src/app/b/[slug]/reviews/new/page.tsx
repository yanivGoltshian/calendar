import Link from 'next/link';
import { notFound } from 'next/navigation';
import { t } from '@/i18n';
import { getClientSession } from '@/lib/session';
import { getBusinessBySlug } from '@/server/repos/business';
import { getReviewEligibility } from '@/server/repos/businessReviews';
import ReviewSubmissionForm from './ReviewSubmissionForm';

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
  const eligibility = session?.userId
    ? await getReviewEligibility(business.id, session.userId)
    : null;
  const labels = t.reviews;
  const back = `/b/${encodeURIComponent(slug)}#reviews`;
  const returnTo = `/b/${encodeURIComponent(slug)}/reviews/new`;
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
      {!session ? (
        <section className="space-y-4 rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold">{labels.loginTitle}</h2>
          <p>{labels.loginHint}</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(returnTo)}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-[#102039] px-5 text-white"
          >
            {labels.login}
          </Link>
        </section>
      ) : eligibility?.appointments.length ? (
        <ReviewSubmissionForm
          slug={slug}
          name={eligibility.appointments[0].client.name}
          appointments={eligibility.appointments.map((appointment) => ({
            id: appointment.id,
            label: `${appointment.services.map((service) => service.nameSnapshot).join(' + ')} · ${new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeZone: business.timezone }).format(appointment.startAt)}`,
          }))}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 p-6">
          {labels.ineligible} {labels.onePerAppointment}
        </p>
      )}
      {eligibility?.submitted.length ? (
        <section className="mt-6 rounded-xl bg-slate-50 p-4">
          <h2 className="font-semibold">{labels.submitted}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {eligibility.submitted.map((review) => (
              <li key={review.id}>
                {review.status === 'PENDING'
                  ? labels.pendingSuccess
                  : labels.statuses[review.status]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
