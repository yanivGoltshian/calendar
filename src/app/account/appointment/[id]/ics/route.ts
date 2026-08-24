import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { requireClientSession } from '@/lib/auth';
import { buildIcs } from '@/lib/calendar';
import { t } from '@/i18n';

/**
 * GET /account/appointment/[id]/ics — הורדת קובץ יומן (ICS) לתור בודד.
 *
 * מוגן בזהות הלקוח: מחזיר את התור רק אם הוא משויך למשתמש המחובר לפי
 * userId / phone / email (אותה לוגיקה כמו אזור החשבון). אחרת 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await requireClientSession();

  const clientOr: Prisma.ClientWhereInput[] = [{ userId: session.userId }];
  if (session.phone) clientOr.push({ phone: session.phone });
  if (session.email) clientOr.push({ email: session.email });

  const appt = await prisma.appointment.findFirst({
    where: { id, client: { OR: clientOr } },
    include: {
      services: { select: { nameSnapshot: true } },
      staff: { select: { displayName: true } },
      business: { select: { name: true, address: true } },
    },
  });

  if (!appt) {
    return new Response('Not found', { status: 404 });
  }

  const serviceNames = appt.services.map((s) => s.nameSnapshot).join(', ');
  const businessName = appt.business.name;
  const title = serviceNames ? `${serviceNames} · ${businessName}` : businessName;
  const details = `${businessName}\n${t.account.with} ${appt.staff.displayName}`;

  const ics = buildIcs({
    id: appt.id,
    title,
    start: appt.startAt,
    end: appt.endAt,
    details,
    location: appt.business.address,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="appointment-${appt.id}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
