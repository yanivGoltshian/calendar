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
import { isValidIsraeliMobile } from '@/lib/crypto';

const addSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => isValidIsraeliMobile(v), 'phone'),
  serviceId: z.string().trim().optional(),
  staffId: z.string().trim().optional(),
  desiredDate: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

export type AddWaitlistState = {
  ok: boolean;
  error?: string;
};

/** הוספת ממתין חדש לרשימת ההמתנה. */
export async function addWaitlistAction(
  _prev: AddWaitlistState,
  formData: FormData,
): Promise<AddWaitlistState> {
  const parsed = addSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    serviceId: formData.get('serviceId') || undefined,
    staffId: formData.get('staffId') || undefined,
    desiredDate: formData.get('desiredDate') || undefined,
    note: formData.get('note') || undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'name' || code === 'phone' ? code : 'generic';
    return { ok: false, error };
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  await addWaitlistEntry(business.id, {
    name: parsed.data.name,
    phone: parsed.data.phone,
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

/** יידוע ממתין (SMS stub) וסימון NOTIFIED. */
export async function notifyAction(formData: FormData): Promise<void> {
  await withBusiness(notifyWaitlistEntry, formData);
}

/** קידום ידני של ממתין (BOOKED). */
export async function promoteAction(formData: FormData): Promise<void> {
  await withBusiness(promoteWaitlistEntry, formData);
}

/** ביטול רשומת המתנה. */
export async function cancelAction(formData: FormData): Promise<void> {
  await withBusiness(cancelWaitlistEntry, formData);
}
