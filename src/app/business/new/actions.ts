'use server';

import { redirect } from 'next/navigation';
import { BusinessType } from '@prisma/client';
import { auth } from '@/auth';
import { createBusiness } from '@/server/repos/business';
import { t } from '@/i18n';

export type CreateBusinessState = {
  error?: string;
};

const VALID_TYPES = new Set(Object.values(BusinessType) as string[]);

/**
 * פעולת יצירת עסק אמיתית (אפיק D1).
 * מאמתת בעלים מחובר, מוודאת שם וסוג, יוצרת עסק חדש בבעלות המייל,
 * וממשיכה לאשף ההקמה הקיים (שעות/שירות/מיתוג) שפועל על העסק הפעיל החדש.
 */
export async function createBusinessAction(
  _prev: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { error: t.business.create.errorAuth };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { error: t.business.create.errorName };
  }

  const rawType = String(formData.get('type') ?? '').trim();
  if (rawType && !VALID_TYPES.has(rawType)) {
    return { error: t.business.create.errorType };
  }
  const type = rawType ? (rawType as BusinessType) : null;

  const phone = String(formData.get('phone') ?? '').trim() || null;
  const address = String(formData.get('address') ?? '').trim() || null;

  try {
    await createBusiness({ name, type, phone, address, ownerEmail: email });
  } catch {
    return { error: t.business.create.errorGeneric };
  }

  // redirect זורק NEXT_REDIRECT ולכן חייב להיות מחוץ ל-try/catch.
  redirect('/admin/onboarding');
}
