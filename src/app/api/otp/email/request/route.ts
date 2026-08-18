import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidEmail, normalizeEmail } from '@/lib/crypto';
import { createOtp } from '@/server/repos/otp';
import { checkOtpRequestAllowed } from '@/server/repos/rateLimit';
import { sendEmailOtp } from '@/server/providers/email';
import { t } from '@/i18n';

const schema = z.object({ email: z.string().min(3).max(254) });

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
 * בקשת קוד OTP במייל (מסלול לקוח): מאמת פורמט מייל, אוכף הגבלת קצב (באותו מנגנון
 * של הטלפון, לפי מזהה המייל), מייצר קוד ושומר hash, ושולח דרך ספק המייל.
 *
 * ספק המייל תמיד פעיל: כשאין SMTP מוגדר הוא מדפיס את הקוד ללוג (fallback),
 * כך שבדיקות מקצה-לקצה עובדות בלי חשבון חיצוני.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidEmail(parsed.data.email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ip = extractClientIp(request);

  // הגבלת קצב: קול-דאון למזהה, תקרה יומית למזהה, ותקרה יומית ל-IP. מזהה המייל
  // משמש כמפתח (עמודת phone ב-OtpCode היא מחרוזת חופשית; אין התנגשות עם טלפונים).
  const decision = await checkOtpRequestAllowed(email, ip);
  if (!decision.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', reason: decision.reason, message: t.auth.tooManyRequests },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } },
    );
  }

  const code = await createOtp(email);

  try {
    await sendEmailOtp(email, code);
  } catch (err) {
    console.error('[otp/email/request] failed to send OTP email:', err);
    return NextResponse.json(
      { ok: false, error: 'send_failed', message: t.auth.sendFailed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
