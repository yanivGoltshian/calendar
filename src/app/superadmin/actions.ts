'use server';

import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getPlatformAdminEmail } from '@/server/platformAdmin';

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
