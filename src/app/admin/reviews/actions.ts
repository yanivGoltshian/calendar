'use server';

import { getActiveBusiness } from '@/server/repos/business';
import { updateLegacyTestimonial } from '@/server/repos/settings';
import { addManualReview, updateBusinessReview } from '@/server/repos/businessReviews';
import { notifyOwnerOfReview } from '@/server/notifications/ownerReview';
import {
  revalidateBusinessReviews,
  reviewActionFailure,
} from '@/server/reviews/actionResult';
import type { ReviewActionState } from '@/lib/businessReviews';
import { z } from 'zod';

export type LegacyReviewActionState = { ok: boolean; error?: ReviewActionState['error'] };
const legacyReviewSchema = z.object({
  index: z.coerce.number().int().nonnegative(),
  name: z.string().trim().max(40),
  quote: z.string().trim().min(1).max(240),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export async function saveLegacyReviewAction(
  _previous: LegacyReviewActionState,
  form: FormData,
): Promise<LegacyReviewActionState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'unauthorized' };
  const parsed = legacyReviewSchema.safeParse({
    index: form.get('index'),
    name: form.get('name') ?? '',
    quote: form.get('quote') ?? '',
    rating: form.get('rating') || undefined,
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    await updateLegacyTestimonial(business.id, parsed.data.index, parsed.data);
  } catch {
    return { ok: false, error: 'save_failed' };
  }
  revalidateBusinessReviews(business.slug);
  return { ok: true };
}

export async function saveBusinessReviewAction(
  _previous: ReviewActionState,
  form: FormData,
): Promise<ReviewActionState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'unauthorized' };
  let id: string;
  let notify = false;
  try {
    const fields = {
      rating: form.get('rating'),
      text: form.get('text') ?? '',
      status: form.get('status'),
    };
    if (form.get('mode') === 'create') {
      const review = await addManualReview(business.id, {
        ...fields,
        name: form.get('name'),
        requestKey: form.get('requestKey'),
      });
      id = review.id;
      notify = review.created && review.status === 'PENDING';
    } else if (form.get('mode') === 'edit') {
      const review = await updateBusinessReview(business.id, {
        ...fields,
        id: form.get('id'),
        version: form.get('version'),
      });
      id = review.id;
    } else {
      return { ok: false, error: 'invalid' };
    }
  } catch (error) {
    return reviewActionFailure(error);
  }
  if (notify) {
    await notifyOwnerOfReview({
      businessId: business.id,
      reviewId: id,
      pushEnabled: business.settings?.pushEnabled ?? false,
    });
  }
  revalidateBusinessReviews(business.slug);
  return { ok: true, id };
}
