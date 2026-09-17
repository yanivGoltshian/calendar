import { BRAND } from '@/config/brand';
import { getPushProvider, type PushProvider } from '@/server/providers/push';

export async function notifyOwnerOfReview(
  input: { businessId: string; reviewId: string; pushEnabled: boolean },
  push: Pick<PushProvider, 'sendToBusiness'> = getPushProvider(),
): Promise<void> {
  if (!input.pushEnabled) return;
  try {
    await push.sendToBusiness(
      input.businessId,
      `${BRAND.name} · המלצה חדשה ממתינה לאישור`,
      'אפשר לבדוק את ההמלצה ולבחור אם לפרסם אותה בעמוד העסק.',
      `/admin/reviews?review=${encodeURIComponent(input.reviewId)}&status=pending`,
    );
  } catch (error) {
    console.error('review_owner_push_failed', {
      reviewId: input.reviewId,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}
