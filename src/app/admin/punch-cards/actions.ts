'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActiveBusiness } from '@/server/repos/business';
import {
  createPunchCard,
  punchPunchCard,
  completePunchCard,
  cancelPunchCard,
} from '@/server/repos/punchCards';
import { shekelsToAgorot } from '@/lib/money';

const createSchema = z.object({
  clientId: z.string().trim().min(1, 'client'),
  serviceId: z.string().trim().optional(),
  title: z.string().trim().max(120).optional(),
  totalPunches: z.coerce.number().int().min(1, 'total').max(100),
  priceShekels: z.coerce.number().min(0).max(100000).optional(),
  note: z.string().trim().max(500).optional(),
});

export type CreatePunchCardState = {
  ok: boolean;
  error?: string;
};

/** יצירת כרטיסיית ניקוב חדשה ללקוח. */
export async function createPunchCardAction(
  _prev: CreatePunchCardState,
  formData: FormData,
): Promise<CreatePunchCardState> {
  const rawPrice = formData.get('priceShekels');
  const parsed = createSchema.safeParse({
    clientId: formData.get('clientId'),
    serviceId: formData.get('serviceId') || undefined,
    title: formData.get('title') || undefined,
    totalPunches: formData.get('totalPunches'),
    priceShekels: rawPrice === '' || rawPrice === null ? undefined : rawPrice,
    note: formData.get('note') || undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'client' || code === 'total' ? code : 'generic';
    return { ok: false, error };
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  const result = await createPunchCard(business.id, {
    clientId: parsed.data.clientId,
    serviceId: parsed.data.serviceId ?? null,
    title: parsed.data.title ?? null,
    totalPunches: parsed.data.totalPunches,
    priceAgorot:
      parsed.data.priceShekels !== undefined
        ? shekelsToAgorot(parsed.data.priceShekels)
        : null,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) return { ok: false, error: 'client' };

  revalidatePath('/admin/punch-cards');
  return { ok: true };
}

async function withBusiness(fn: (businessId: string, id: string) => Promise<unknown>, formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  await fn(business.id, id);
  revalidatePath('/admin/punch-cards');
}

/** ניקוב כרטיסייה (‎+1, השלמה אוטומטית כשמתמלאת). */
export async function punchAction(formData: FormData): Promise<void> {
  await withBusiness(punchPunchCard, formData);
}

/** מימוש/סגירה ידנית של כרטיסייה. */
export async function completeAction(formData: FormData): Promise<void> {
  await withBusiness(completePunchCard, formData);
}

/** ביטול כרטיסייה. */
export async function cancelAction(formData: FormData): Promise<void> {
  await withBusiness(cancelPunchCard, formData);
}
