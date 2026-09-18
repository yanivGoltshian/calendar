import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { BusinessReviewError, type ReviewActionState } from '@/lib/businessReviews';

export function reviewActionFailure(error: unknown): ReviewActionState {
  if (error instanceof BusinessReviewError) return { ok: false, error: error.code };
  if (error instanceof ZodError) return { ok: false, error: 'invalid' };
  console.error('business_review_save_failed', {
    error: error instanceof Error ? error.name : 'unknown',
  });
  return { ok: false, error: 'save_failed' };
}

export function revalidateBusinessReviews(slug: string) {
  revalidatePath('/admin', 'layout');
  revalidatePath('/admin/reviews');
  revalidatePath(`/b/${slug}`);
}
