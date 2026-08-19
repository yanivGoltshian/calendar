import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findOrCreateUserByPhone } from '@/server/repos/otp';
import { setClientSession } from '@/lib/session';
import { firebaseAdminConfigured } from '@/lib/firebase/admin';
import { verifyFirebasePhoneIdToken } from '@/server/auth/firebasePhone';

const schema = z.object({
  idToken: z.string().min(20),
  name: z.string().trim().max(80).optional(),
});

/**
 * התחברות לקוח באמצעות אימות טלפון של Firebase.
 * מקבל Firebase ID token שהופק בצד הלקוח (לאחר signInWithPhoneNumber),
 * מאמת אותו עם firebase-admin, מחלץ את מספר הטלפון המאומת, ומגדיר עוגיית לקוח.
 * מגודר ב-env: אם firebase-admin אינו מוגדר — מחזיר 404 בעדינות.
 */
export async function POST(request: Request) {
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const verified = await verifyFirebasePhoneIdToken(parsed.data.idToken);
  if (!verified.ok) {
    const status = verified.reason === 'invalid_token' ? 401 : 400;
    return NextResponse.json({ ok: false, error: verified.reason }, { status });
  }

  const user = await findOrCreateUserByPhone(verified.phone, parsed.data.name);
  await setClientSession({
    userId: user.id,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, phone: user.phone, name: user.name },
  });
}
