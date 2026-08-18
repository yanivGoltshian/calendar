import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';
import { checkOtp, findOrCreateUserByPhone } from '@/server/repos/otp';
import { setClientSession } from '@/lib/session';

const schema = z.object({
  phone: z.string().min(6),
  code: z.string().min(4).max(8),
  name: z.string().trim().max(80).optional(),
});

/** אימות קוד OTP: אם תקין — יוצר/מוצא משתמש ומגדיר עוגיית התחברות. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidIsraeliMobile(parsed.data.phone)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  const result = await checkOtp(phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 401 });
  }

  const user = await findOrCreateUserByPhone(phone, parsed.data.name);
  await setClientSession({
    userId: user.id,
    phone: user.phone ?? undefined,
    name: user.name ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, phone: user.phone, name: user.name },
  });
}
