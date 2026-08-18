import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidEmail, normalizeEmail } from '@/lib/crypto';
import { checkOtp, findOrCreateUserByEmail } from '@/server/repos/otp';
import { setClientSession } from '@/lib/session';

const schema = z.object({
  email: z.string().min(3).max(254),
  code: z.string().min(4).max(8),
  name: z.string().trim().max(80).optional(),
});

/** אימות קוד OTP במייל (מסלול לקוח): אם תקין — יוצר/מוצא משתמש לפי מייל ומגדיר עוגיית התחברות. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidEmail(parsed.data.email)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const result = await checkOtp(email, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 401 });
  }

  const user = await findOrCreateUserByEmail(email, parsed.data.name);
  await setClientSession({
    userId: user.id,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
