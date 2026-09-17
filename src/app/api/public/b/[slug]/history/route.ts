import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/session';
import { historyCursorSchema } from '@/lib/appointmentHistory';
import { getBusinessBySlug } from '@/server/repos/business';
import { getAppointmentHistory } from '@/server/repos/appointmentHistory';
import { historyAppointmentView } from '@/server/appointmentHistory';

export const dynamic = 'force-dynamic';
const privateResponse = {
  headers: { 'cache-control': 'private, no-store', vary: 'Cookie' },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getClientSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { ...privateResponse, status: 401 },
      );
    }
    const query = new URL(request.url).searchParams;
    const hasCursor = query.has('before') || query.has('beforeId');
    const cursor = historyCursorSchema.safeParse({
      startAt: query.get('before'),
      id: query.get('beforeId'),
    });
    if (hasCursor && !cursor.success) {
      return NextResponse.json(
        { error: 'invalid_cursor' },
        { ...privateResponse, status: 400 },
      );
    }

    const { slug } = await params;
    const business = await getBusinessBySlug(slug);
    if (!business) {
      return NextResponse.json(
        { error: 'not_found' },
        { ...privateResponse, status: 404 },
      );
    }
    const page = await getAppointmentHistory(
      session.userId,
      business.id,
      hasCursor && cursor.success ? cursor.data : null,
    );
    return NextResponse.json(
      {
        appointments: page.appointments.map((appointment) =>
          historyAppointmentView(appointment, business),
        ),
        nextCursor: page.nextCursor,
      },
      privateResponse,
    );
  } catch (error) {
    console.error('appointment_history_load_failed', error);
    return NextResponse.json(
      { error: 'history_unavailable' },
      { ...privateResponse, status: 500 },
    );
  }
}
