import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';
import { createOtp } from '@/server/repos/otp';
import { checkOtpRequestAllowed } from '@/server/repos/rateLimit';
import {
  getMessagingProvider,
  MessagingConfigError,
  MessagingSendError,
} from '@/server/providers/messaging';
import { t } from '@/i18n';

const schema = z.object({ phone: z.string().min(6) });

/** חילוץ כתובת ה-IP של הלקוח מכותרות ה-proxy (best-effort). */
function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

/**
 * בקשת קוד OTP: מאמת קלט, אוכף הגבלת קצב, מייצר קוד, שומר hash, ושולח דרך
 * ספק ההודעות שנקבע ב-SMS_PROVIDER. אם הספק אינו מוגדר כראוי בפרודקשן, נכשל
 * ברעש: רושם ללוג ומחזיר שגיאה מטופלת עם הודעת i18n גנרית, לעולם לא הצלחה
 * שקטה ללא שליחה אמיתית.
 */
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
  const ip = extractClientIp(request);

  // פתרון הספק תחילה: אם התצורה שגויה (למשל console בפרודקשן או חוסר
  // קרדנשלס), נכשלים לפני יצירת OTP שלא ניתן לשלוח.
  let provider;
  try {
    provider = getMessagingProvider();
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      console.error('[otp/request] messaging provider misconfigured:', err.message);
      return NextResponse.json(
        { ok: false, error: 'send_failed', message: t.auth.sendFailed },
        { status: 500 },
      );
    }
    throw err;
  }

  // הגבלת קצב: קול-דאון לטלפון, תקרה יומית לטלפון, ותקרה יומית ל-IP.
  const decision = await checkOtpRequestAllowed(phone, ip);
  if (!decision.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', reason: decision.reason, message: t.auth.tooManyRequests },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } },
    );
  }

  const code = await createOtp(phone);

  try {
    await provider.sendOtp(phone, code);
  } catch (err) {
    if (err instanceof MessagingSendError || err instanceof MessagingConfigError) {
      console.error('[otp/request] failed to send OTP:', err.message);
    } else {
      console.error('[otp/request] unexpected error sending OTP:', err);
    }
    return NextResponse.json(
      { ok: false, error: 'send_failed', message: t.auth.sendFailed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
