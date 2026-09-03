'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActiveBusiness } from '@/server/repos/business';
import {
  addWaitlistEntry,
  notifyWaitlistEntry,
  promoteWaitlistEntry,
  cancelWaitlistEntry,
} from '@/server/repos/waitlist';
import { setWaitlistEnabled } from '@/server/repos/settings';
import { parseWaitlistEnabled } from './parse';
import { isValidIsraeliMobile } from '@/lib/crypto';
import { canSendPaidClientSms } from '@/server/subscription';

const addSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => isValidIsraeliMobile(v), 'phone'),
  email: z.string().trim().email('email').optional(),
  serviceId: z.string().trim().optional(),
  staffId: z.string().trim().optional(),
  desiredDate: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

export type AddWaitlistState = {
  ok: boolean;
  error?: string;
};

/**
 * הפעלה/כיבוי של רשימת ההמתנה לעסק הפעיל. מקור האמת היחיד לדגל
 * BusinessSettings.waitlistEnabled; נקרא מהטוגל בראש עמוד /admin/waitlist.
 */
export async function setWaitlistEnabledAction(formData: FormData): Promise<void> {
  const enabled = parseWaitlistEnabled(formData);
  const business = await getActiveBusiness();
  if (!business) return;
  await setWaitlistEnabled(business.id, enabled);
  revalidatePath('/admin/waitlist');
  // מתג רשימת ההמתנה משפיע על ה-gate בעמוד ההזמנה (#130) ולכן מרעננים את שני
  // עמודי ה-ISR הציבוריים כדי שהשינוי ישתקף מיד ולא רק בטיימר.
  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/b/${business.slug}/book`);
}

/** הוספת ממתין חדש לרשימת ההמתנה. */
export async function addWaitlistAction(
  _prev: AddWaitlistState,
  formData: FormData,
): Promise<AddWaitlistState> {
  const parsed = addSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email') || undefined,
    serviceId: formData.get('serviceId') || undefined,
    staffId: formData.get('staffId') || undefined,
    desiredDate: formData.get('desiredDate') || undefined,
    note: formData.get('note') || undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error =
      code === 'name' || code === 'phone' || code === 'email' ? code : 'generic';
    return { ok: false, error };
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  // הגנה בעומק: גם אם ה-UI מושבת, לא מוסיפים ממתין כשרשימת ההמתנה כבויה.
  if (business.settings?.waitlistEnabled === false) {
    return { ok: false, error: 'disabled' };
  }

  await addWaitlistEntry(business.id, {
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email ?? null,
    serviceId: parsed.data.serviceId ?? null,
    staffId: parsed.data.staffId ?? null,
    desiredDate: parsed.data.desiredDate ?? null,
    note: parsed.data.note ?? null,
  });

  revalidatePath('/admin/waitlist');
  return { ok: true };
}

async function withBusiness(
  fn: (businessId: string, id: string) => Promise<unknown>,
  formData: FormData,
) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  await fn(business.id, id);
  revalidatePath('/admin/waitlist');
}

/** יידוע ממתין: מסרון בתשלום לאקסקלוסיב דרך שער העלות, וסימון NOTIFIED. */
export async function notifyAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  await notifyWaitlistEntry(business.id, id, {
    isExclusive: canSendPaidClientSms(business),
  });
  revalidatePath('/admin/waitlist');
}

/** קידום ידני של ממתין (BOOKED). */
export async function promoteAction(formData: FormData): Promise<void> {
  await withBusiness(promoteWaitlistEntry, formData);
}

/** ביטול רשומת המתנה. */
export async function cancelAction(formData: FormData): Promise<void> {
  await withBusiness(cancelWaitlistEntry, formData);
}
