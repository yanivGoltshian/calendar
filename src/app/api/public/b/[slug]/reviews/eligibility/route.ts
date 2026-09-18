import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/session';
import { getBusinessBySlug } from '@/server/repos/business';
import { getReviewSubmissionContext } from '@/server/reviews/submissionContext';

export const dynamic = 'force-dynamic';
const headers = { 'cache-control': 'private, no-store', vary: 'Cookie' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const business = await getBusinessBySlug(slug);
    if (!business)
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
    const session = await getClientSession();
    const context = await getReviewSubmissionContext(business, session?.userId);
    return NextResponse.json(context, { headers });
  } catch (error) {
    console.error('review_eligibility_load_failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return NextResponse.json({ error: 'load_failed' }, { status: 500, headers });
  }
}
