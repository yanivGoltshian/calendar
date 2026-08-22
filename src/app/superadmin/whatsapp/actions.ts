'use server';

import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { currentMonth } from '@/server/whatsapp/cost';

/**
 * פעולות שרת ללוח עלויות הוואטסאפ בניהול-על. כל פעולה בודקת מחדש את שער האדמין
 * בצד השרת (getPlatformAdminEmail) ולא מסתמכת על שער העמוד בלבד. גישה לא מורשית ⇒ 404.
 */

async function assertPlatformAdmin(): Promise<void> {
  const email = await getPlatformAdminEmail();
  if (!email) notFound();
}

function readBusinessId(formData: FormData): string {
  const id = String(formData.get('businessId') ?? '').trim();
  if (!id) notFound();
  return id;
}

/**
 * אישור חריגה לחודש הנוכחי: מסיר את החסימה (whatsappBlocked=false) ומסמן
 * whatsappOverrideApprovedForMonth=החודש הנוכחי. השליחה בוואטסאפ מתחדשת עד סוף החודש;
 * בתחילת החודש הבא הצובר מתאפס והחסימה נבחנת מחדש. אין השפעה על עלות שנצברה.
 */
export async function approveOverrideAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const businessId = readBusinessId(formData);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) notFound();

  await prisma.business.update({
    where: { id: businessId },
    data: {
      whatsappBlocked: false,
      whatsappOverrideApprovedForMonth: currentMonth(),
    },
  });

  revalidatePath('/superadmin/whatsapp');
}
