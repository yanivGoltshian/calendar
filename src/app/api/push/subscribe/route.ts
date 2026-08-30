import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveBusiness } from '@/server/repos/business';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * רישום מנוי Web Push של דפדפן בעל העסק.
 *
 * שער בעלות נאכף במפורש (route handler אינו עובר דרך admin/layout): נדרש session
 * מחובר ועסק פעיל. גוף הבקשה הוא אובייקט PushSubscription סטנדרטי של הדפדפן
 * ({ endpoint, keys: { p256dh, auth } }). הרישום הוא upsert לפי endpoint ייחודי,
 * כך שרישום חוזר מאותו דפדפן אינו יוצר כפילות ומעדכן מפתחות אם התחדשו.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'נדרשת התחברות.' }, { status: 401 });
  }

  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ error: 'אין הרשאה.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'בקשה שגויה.' }, { status: 400 });
  }

  const sub = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const authKey = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'מנוי דחיפה חסר או שגוי.' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { businessId: business.id, endpoint, p256dh, auth: authKey },
    update: { businessId: business.id, p256dh, auth: authKey },
  });

  return NextResponse.json({ ok: true });
}
