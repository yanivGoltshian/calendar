'use server';

import { z } from 'zod';
import { getClientSession } from '@/lib/session';
import { reviewInputSchema, type ReviewActionState } from '@/lib/businessReviews';
import { getBusinessBySlug } from '@/server/repos/business';
import { submitCustomerReview } from '@/server/repos/businessReviews';
import { notifyOwnerOfReview } from '@/server/notifications/ownerReview';
import {
  revalidateBusinessReviews,
  reviewActionFailure,
} from '@/server/reviews/actionResult';

const submissionSchema = reviewInputSchema.extend({
  slug: z.string().min(1).max(120),
  appointmentId: z.string().min(1).max(100),
});

export async function submitBusinessReviewAction(
  _previous: ReviewActionState,
  form: FormData,
): Promise<ReviewActionState> {
  const session = await getClientSession();
  if (!session?.userId) return { ok: false, error: 'unauthorized' };
  const parsed = submissionSchema.safeParse({
    slug: form.get('slug'),
    appointmentId: form.get('appointmentId'),
    name: form.get('name'),
    rating: form.get('rating'),
    text: form.get('text') ?? '',
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const business = await getBusinessBySlug(parsed.data.slug);
  if (!business) return { ok: false, error: 'ineligible' };
  let review: { id: string };
  try {
    review = await submitCustomerReview(
      business.id,
      session.userId,
      parsed.data.appointmentId,
      parsed.data,
    );
  } catch (error) {
    return reviewActionFailure(error);
  }
  await notifyOwnerOfReview({
    businessId: business.id,
    reviewId: review.id,
    pushEnabled: business.settings?.pushEnabled ?? false,
  });
  revalidateBusinessReviews(business.slug);
  return { ok: true, id: review.id };
}
