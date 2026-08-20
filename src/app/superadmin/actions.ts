'use server';

import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { isSlugConfirmed, parseEditBusinessInput } from './logic';

/**
 * פעולות שרת לקונסולת ניהול-העל. כל פעולה בודקת מחדש את שער האדמין בצד השרת
 * (getPlatformAdminEmail) — לא מסתמכת על שער העמוד בלבד. גישה לא מורשית ⇒ 404.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

async function assertPlatformAdmin(): Promise<void> {
  const email = await getPlatformAdminEmail();
  if (!email) notFound();
}

function readBusinessId(formData: FormData): string {
  const id = String(formData.get('businessId') ?? '').trim();
  if (!id) notFound();
  return id;
}

/** הארכת ניסיון: מוסיף N ימים ל-trialEndsAt (מהמאוחר מבין עכשיו/הקיים) וקובע trialing. */
export async function extendTrialAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);

  const rawDays = Number(formData.get('days'));
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : 14;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { trialEndsAt: true },
  });
  if (!business) notFound();

  const nowMs = Date.now();
  const currentMs = business.trialEndsAt ? business.trialEndsAt.getTime() : 0;
  const baseMs = Math.max(nowMs, currentMs);
  const trialEndsAt = new Date(baseMs + days * DAY_MS);

  await prisma.business.update({
    where: { id: businessId },
    data: { trialEndsAt, subscriptionStatus: 'trialing' },
  });

  revalidatePath('/superadmin');
}

/** שדרוג לפרימיום: plan=premium, active, paidUntil, סכום ידני (₪→אגורות), premiumSince, הערה. */
export async function upgradePremiumAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);

  const paidUntilRaw = String(formData.get('paidUntil') ?? '').trim();
  const paidUntil = paidUntilRaw ? new Date(paidUntilRaw) : null;
  // חובה תאריך תקף להמשך התשלום.
  if (!paidUntil || Number.isNaN(paidUntil.getTime())) {
    return;
  }

  const amountShekelRaw = Number(formData.get('amountShekel'));
  const manualAmountAgorot =
    Number.isFinite(amountShekelRaw) && amountShekelRaw > 0
      ? Math.round(amountShekelRaw * 100)
      : null;

  const notesRaw = String(formData.get('planNotes') ?? '').trim();
  const planNotes = notesRaw.length > 0 ? notesRaw : null;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      plan: 'premium',
      subscriptionStatus: 'active',
      paidUntil,
      manualAmountAgorot,
      premiumSince: new Date(),
      planNotes,
    },
  });

  revalidatePath('/superadmin');
}

/** החזרה לבסיס: plan=basic, חישוב סטטוס מחדש מ-trialEndsAt (trialing אם בעתיד, אחרת expired). */
export async function revertToBasicAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { trialEndsAt: true },
  });
  if (!business) notFound();

  const stillTrialing =
    business.trialEndsAt != null && business.trialEndsAt.getTime() > Date.now();

  await prisma.business.update({
    where: { id: businessId },
    data: {
      plan: 'basic',
      subscriptionStatus: stillTrialing ? 'trialing' : 'expired',
    },
  });

  revalidatePath('/superadmin');
}

/** עריכת פרטי עסק: שם (חובה), טלפון, מייל בעלים והערת חבילה. אימות/ניקוי בלוגיקה טהורה. */
export async function editBusinessDetailsAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);

  const parsed = parseEditBusinessInput({
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    ownerEmail: String(formData.get('ownerEmail') ?? ''),
    planNotes: String(formData.get('planNotes') ?? ''),
  });
  // קלט לא תקין (שם ריק / מייל פגום) — לא משנים דבר.
  if (!parsed.ok) return;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      ownerEmail: parsed.data.ownerEmail,
      planNotes: parsed.data.planNotes,
    },
  });

  revalidatePath('/superadmin');
}

/**
 * מחיקת חשבון עסק לצמיתות — דורש הקלדת ה-slug המדויק כאישור.
 * מוחק תחילה את התורים (מפיל בכך את AppointmentService המקושר, שעליו יש onDelete: Restrict)
 * ואז את העסק, שמפעיל cascade על שאר הילדים (לקוחות, מכירות, מוצרים, מסמכים ועוד).
 * שני הצעדים ב-$transaction כדי לשמור על אטומיות.
 */
export async function deleteBusinessAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);
  const confirmSlug = String(formData.get('confirmSlug') ?? '');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { slug: true },
  });
  if (!business) notFound();

  // שער אישור: ה-slug שהוקלד חייב להתאים במדויק. אי-התאמה ⇒ ביטול שקט.
  if (!isSlugConfirmed(confirmSlug, business.slug)) return;

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { businessId } }),
    prisma.business.delete({ where: { id: businessId } }),
  ]);

  revalidatePath('/superadmin');
}
