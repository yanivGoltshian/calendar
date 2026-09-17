import { notFound } from 'next/navigation';
import { t } from '@/i18n';
import { normalizeStoredLandingContent } from '@/lib/publicPageStyle';
import { getActiveBusiness } from '@/server/repos/business';
import { listAdminBusinessReviews } from '@/server/repos/businessReviews';
import ReviewsManager from './ReviewsManager';

export const metadata = { title: t.reviews.title };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; review?: string }>;
}) {
  const business = await getActiveBusiness();
  if (!business) notFound();
  const reviews = await listAdminBusinessReviews(business.id);
  const legacy =
    normalizeStoredLandingContent(business.landingContent)?.testimonials ?? [];
  const search = await searchParams;
  const selectedReview = reviews.find((review) => review.id === search.review);
  const requestedStatus = search.status?.toUpperCase();
  const initialStatus =
    requestedStatus === 'PENDING' ||
    requestedStatus === 'PUBLISHED' ||
    requestedStatus === 'HIDDEN'
      ? requestedStatus
      : undefined;
  return (
    <ReviewsManager
      reviews={reviews}
      slug={business.slug}
      initialStatus={selectedReview?.status ?? initialStatus}
      selectedReviewId={selectedReview?.id}
      legacyReviews={legacy.map((review) => ({
        name: review.name,
        quote: review.quote,
        rating: review.rating,
        source: review.source?.provider === 'google' ? 'google' : 'unknown',
        status: review.hidden ? 'HIDDEN' : 'PUBLISHED',
      }))}
    />
  );
}
