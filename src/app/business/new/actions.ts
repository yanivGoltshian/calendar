'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createBusiness } from '@/server/repos/business';
import { parseCreateBusinessInput } from './parseInput';
import { t } from '@/i18n';

export type CreateBusinessState = {
  error?: string;
};

/**
 * פעולת יצירת עסק אמיתית (אפיק D1).
 * מאמתת בעלים מחובר, מוודאת שם וסוג, ויוצרת עסק חדש בבעלות המייל.
 * מיד אחרי היצירה מנתבים את הבעלים לאשף ההקמה המודרך (/admin/onboarding),
 * שם הוא מאשר שירותים, קובע שעות, ממתג ומקבל את קישור ההזמנות — במקום לנחות
 * על לוח ניהול עמוס. createBusiness כבר זורע שירותים ושעות ברירת מחדל.
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

  // פענוח וולידציה חולצו לפונקציה טהורה `parseCreateBusinessInput` (ניתנת לבדיקה).
  // המרת FormData: get מחזיר string או null (ערכי File אינם רלוונטיים לטופס זה).
  const parsed = parseCreateBusinessInput((key) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : null;
  });
  if (!parsed.ok) {
    return {
      error: parsed.error === 'name' ? t.business.create.errorName : t.business.create.errorType,
    };
  }
  const { name, type, phone, address, priorCalendar, referralSource } = parsed.value;

  try {
    await createBusiness({
      name,
      type,
      phone,
      address,
      ownerEmail: email,
      ownerName: session.user?.name ?? null,
      priorCalendar,
      referralSource,
    });
  } catch {
    return { error: t.business.create.errorGeneric };
  }

  // בעלים חדש (הקמה טרם הושלמה) נכנס לאשף ההקמה המודרך.
  // redirect זורק NEXT_REDIRECT ולכן חייב להיות מחוץ ל-try/catch.
  redirect('/admin/onboarding');
}
