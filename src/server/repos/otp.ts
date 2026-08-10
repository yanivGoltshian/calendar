import { prisma } from '@/lib/db';
import { generateOtpCode, hashOtp, verifyOtp } from '@/lib/crypto';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

/**
 * יצירת קוד OTP חדש לטלפון. מבטל קודים קודמים שלא נוצלו,
 * שומר hash בלבד ומחזיר את הקוד (לצורך שליחה בערוץ ה-SMS).
 */
export async function createOtp(phone: string): Promise<string> {
  // ביטול קודים פעילים קודמים לאותו טלפון.
  await prisma.otpCode.updateMany({
    where: { phone, consumed: false },
    data: { consumed: true },
  });

  const code = generateOtpCode();
  const codeHash = hashOtp(code, phone);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({
    data: { phone, codeHash, expiresAt },
  });

  return code;
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

/** אימות קוד OTP: בדיקת תוקף, ניסיונות והשוואת hash בזמן קבוע. */
export async function checkOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { ok: false, reason: 'not_found' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  if (!verifyOtp(code, phone, record.codeHash)) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: 'mismatch' };
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return { ok: true };
}

/** מציאת משתמש לפי טלפון או יצירתו. */
export async function findOrCreateUserByPhone(phone: string, name?: string) {
  return prisma.user.upsert({
    where: { phone },
    update: name ? { name } : {},
    create: { phone, name, role: 'CLIENT' },
  });
}
