import type { ReviewSubmissionContext } from '@/lib/businessReviews';
import { getReviewEligibility } from '@/server/repos/businessReviews';

export async function getReviewSubmissionContext(
  business: { id: string; timezone: string },
  userId?: string,
): Promise<ReviewSubmissionContext> {
  if (!userId) return { mode: 'guest' };
  const eligibility = await getReviewEligibility(business.id, userId);
  return {
    mode: 'customer',
    name: eligibility.appointments[0]?.client.name ?? '',
    appointments: eligibility.appointments.map((appointment) => ({
      id: appointment.id,
      label: `${appointment.services.map((service) => service.nameSnapshot).join(' + ')} · ${new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeZone: business.timezone }).format(appointment.startAt)}`,
    })),
    submitted: eligibility.submitted,
  };
}
