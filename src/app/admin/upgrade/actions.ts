'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getActiveBusiness } from '@/server/repos/business';
import { bookingUrl } from '@/lib/booking-link';
import { notifyOwnerOfInquiry } from '@/server/notifications/ownerInquiry';

/**
 * שרת-אקשן לשליחת בקשת הצעת מחיר לשדרוג חבילה (D4).
 *
 * סדר פעולות מכוון:
 *  1. אימות בעל העסק והבאת העסק הפעיל (מתוך ה-session, לא מהטופס).
 *  2. אימות קלט (חבילה, שם, מייל, טלפון).
 *  3. *התמדה תחילה* — יצירת PlanInquiry במסד, כדי ששום בקשה לא תאבד גם אם
 *     ההתראה תיכשל.
 *  4. התראת בעל האתר (מייל תמיד + וואטסאפ מיטבי), ועדכון סטטוס/תאריכים בהתאם.
 *
 * כתובת העמוד הציבורי נגזרת בשרת מה-slug של העסק (לא נסמכים על ערך מהטופס).
 */

const schema = z.object({
  plan: z.enum(['STANDARD', 'PREMIUM', 'EXCLUSIVE']),
  name: z.string().trim().min(1, 'name'),
  email: z.string().trim().email('email'),
  phone: z.string().trim().min(6, 'phone'),
});

export type QuoteRequestState = {
  ok: boolean;
  error?: 'auth' | 'plan' | 'name' | 'email' | 'phone' | 'generic';
};

export async function submitQuoteRequest(
  _prev: QuoteRequestState,
  formData: FormData,
): Promise<QuoteRequestState> {
  const session = await auth();
  const sessionEmail = session?.user?.email;
  if (!sessionEmail) return { ok: false, error: 'auth' };

  const business = await getActiveBusiness();
  if (!business || business.ownerEmail !== sessionEmail) {
    return { ok: false, error: 'auth' };
  }

  const parsed = schema.safeParse({
    plan: formData.get('plan'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error =
      code === 'name' || code === 'email' || code === 'phone'
        ? code
        : 'plan';
    return { ok: false, error: error as QuoteRequestState['error'] };
  }

  const data = parsed.data;
  const publicPageUrl = bookingUrl(business.slug);

  // (3) התמדה תחילה — הבקשה נשמרת לפני כל ניסיון התראה.
  try {
    const inquiry = await prisma.planInquiry.create({
      data: {
        businessId: business.id,
        publicPageUrl,
        ownerName: data.name,
        email: data.email,
        phone: data.phone,
        requestedPlan: data.plan,
        status: 'NEW',
      },
      select: { id: true, createdAt: true },
    });

    // (4) התראת בעל האתר — לעולם אינה זורקת; נעדכן סטטוס לפי התוצאה.
    const result = await notifyOwnerOfInquiry({
      id: inquiry.id,
      businessName: business.name,
      publicPageUrl,
      ownerName: data.name,
      email: data.email,
      phone: data.phone,
      requestedPlan: data.plan,
      createdAt: inquiry.createdAt,
    });

    const anySent = result.emailed || result.whatsapped;
    await prisma.planInquiry.update({
      where: { id: inquiry.id },
      data: {
        status: anySent ? 'NOTIFIED' : 'FAILED',
        emailedAt: result.emailed ? new Date() : null,
        whatsappedAt: result.whatsapped ? new Date() : null,
        notifyError: result.errors.length
          ? result.errors.join(' | ').slice(0, 500)
          : null,
      },
    });
  } catch (err) {
    // כשל בהתמדה עצמה (למשל מסד לא זמין): מדווחים שגיאה כללית לטופס.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[quote:submit] persistence failed — ${msg}`);
    return { ok: false, error: 'generic' };
  }

  return { ok: true };
}
