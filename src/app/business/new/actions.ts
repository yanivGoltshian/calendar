'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createBusiness } from '@/server/repos/business';
import { listServices } from '@/server/repos/services';
import { parseCreateBusinessInput } from './parseInput';
import { t } from '@/i18n';

export type CreateBusinessState = {
  error?: string;
};

/**
 * פעולת יצירת עסק אמיתית (אפיק D1).
 * מאמתת בעלים מחובר, מוודאת שם וסוג, ויוצרת עסק חדש בבעלות המייל.
 * נחיתה חכמה אחרי היצירה (אונבורדינג): אם לעסק אין אף שירות (למשל אם זריעת
 * תבנית השירותים נכשלה) שולחים אותו למסך יצירת השירותים, אחרת ליומן הניהול
 * שבו מופיעה רשימת ההמשך המודרכת. כך הבעלים לעולם לא נוחת על יומן ריק וללא מוצא.
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

  let created: Awaited<ReturnType<typeof createBusiness>>;
  try {
    created = await createBusiness({
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

  // נחיתה חכמה: עסק ללא שירותים נשלח למסך יצירת השירותים כדי שלא ינחת על יומן ריק;
  // עסק עם שירותים (המצב הרגיל אחרי זריעת התבנית) נוחת ביומן הניהול עם רשימת ההמשך.
  // הקריאה עמידה לתקלות: כשל בספירת השירותים לא ישבור את הזרימה ויפול חזרה למסך השירותים.
  let hasServices = false;
  try {
    const services = await listServices(created.id);
    hasServices = services.length > 0;
  } catch {
    hasServices = false;
  }

  // redirect זורק NEXT_REDIRECT ולכן חייב להיות מחוץ ל-try/catch.
  redirect(hasServices ? '/admin' : '/admin/services');
}
