import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * ביטול רישום מנוי Web Push (למשל בלחיצה על "כבה התראות" בדפדפן).
 *
 * נדרש session מחובר. הגוף הוא { endpoint }. המחיקה מתבצעת לפי endpoint ייחודי
 * דרך deleteMany (אידמפוטנטי — לא נכשל אם המנוי כבר נמחק). איננו זולגים מידע על
 * בעלות: כל מנוי מזוהה חד-ערכית ב-endpoint שלו.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'נדרשת התחברות.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'בקשה שגויה.' }, { status: 400 });
  }

  const endpoint = typeof (body as { endpoint?: unknown })?.endpoint === 'string'
    ? (body as { endpoint: string }).endpoint
    : '';
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint חסר.' }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });

  return NextResponse.json({ ok: true });
}
