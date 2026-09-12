export const ENGAGEMENT_SEGMENTS = ['recent_bookers', 'returning', 'past_clients'] as const;
export type EngagementSegment = typeof ENGAGEMENT_SEGMENTS[number];
export const CLIENT_SEGMENTS = ['all', 'active', 'with_appointments', ...ENGAGEMENT_SEGMENTS] as const;
export type ClientSegment = typeof CLIENT_SEGMENTS[number];

export type EngagementSummary = {
  bookingCount: number;
  recentBooking: boolean;
  visited: boolean;
  quarterBooking: boolean;
};

export function engagementTags(summary: EngagementSummary): EngagementSegment[] {
  return [
    ...(summary.recentBooking ? ['recent_bookers' as const] : []),
    ...(summary.bookingCount >= 4 ? ['returning' as const] : []),
    ...(summary.visited && !summary.quarterBooking ? ['past_clients' as const] : []),
  ];
}

export function isClientSegment(value: unknown): value is ClientSegment {
  return CLIENT_SEGMENTS.some(segment => segment === value);
}
