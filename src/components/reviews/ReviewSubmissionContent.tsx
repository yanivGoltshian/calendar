'use client';

import Link from 'next/link';
import { t } from '@/i18n';
import type { ReviewSubmissionContext } from '@/lib/businessReviews';
import ReviewSubmissionForm from '@/app/b/[slug]/reviews/new/ReviewSubmissionForm';

export default function ReviewSubmissionContent({
  slug,
  context,
  onClose,
}: {
  slug: string;
  context: ReviewSubmissionContext;
  onClose?: () => void;
}) {
  const labels = t.reviews;
  const returnTo = `/b/${encodeURIComponent(slug)}/reviews/new`;
  return (
    <>
      {context.mode === 'guest' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold">{labels.loginTitle}</h3>
          <p>{labels.loginHint}</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(returnTo)}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-[#102039] px-5 text-white"
          >
            {labels.login}
          </Link>
        </section>
      ) : context.appointments.length ? (
        <ReviewSubmissionForm
          slug={slug}
          name={context.name}
          appointments={context.appointments}
          onClose={onClose}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 p-6">
          {labels.ineligible} {labels.onePerAppointment}
        </p>
      )}
      {context.mode === 'customer' && context.submitted.length ? (
        <section className="mt-6 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold">{labels.submitted}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {context.submitted.map((review) => (
              <li key={review.id}>
                {review.status === 'PENDING'
                  ? labels.pendingSuccess
                  : labels.statuses[review.status]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
