import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';
import { createOtp } from '@/server/repos/otp';
import { getSmsProvider } from '@/server/providers/sms';

const schema = z.object({ phone: z.string().min(6) });

/** בקשת קוד OTP: מייצר קוד, שומר hash, ושולח דרך ספק ה-SMS (console בפיתוח). */
export async function POST(request: Request) {
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

  if (!isValidIsraeliMobile(parsed.data.phone)) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  const code = await createOtp(phone);
  await getSmsProvider().sendOtp(phone, code);

  return NextResponse.json({ ok: true });
}
