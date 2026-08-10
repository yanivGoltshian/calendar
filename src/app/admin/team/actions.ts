'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getFirstBusiness } from '@/server/repos/business';
import {
  createStaffMember,
  updateStaffMember,
  setStaffActive,
  deleteStaffMember,
  type StaffInput,
} from '@/server/repos/staff';
import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';

const saveSchema = z.object({
  id: z.string().trim().optional(),
  phone: z.string().trim().min(1, 'phone'),
  name: z.string().trim().max(120).optional(),
  displayName: z.string().trim().min(1, 'name'),
  title: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  permissionLevel: z.enum(['CALENDAR_ONLY', 'MANAGER']),
  active: z.boolean(),
});

export type SaveStaffState = {
  ok: boolean;
  mode: 'add' | 'edit';
  error?: string;
};

function checkbox(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

/** יצירה או עדכון של איש צוות (חתימת useActionState). */
export async function saveStaffAction(
  _prev: SaveStaffState,
  formData: FormData,
): Promise<SaveStaffState> {
  const rawId = String(formData.get('id') ?? '').trim();
  const mode: 'add' | 'edit' = rawId ? 'edit' : 'add';

  const parsed = saveSchema.safeParse({
    id: rawId || undefined,
    phone: formData.get('phone'),
    name: formData.get('name') || undefined,
    displayName: formData.get('displayName'),
    title: formData.get('title') || undefined,
    bio: formData.get('bio') || undefined,
    permissionLevel: formData.get('permissionLevel'),
    active: checkbox(formData, 'active'),
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'name' || code === 'phone' ? code : 'generic';
    return { ok: false, mode, error };
  }

  const data = parsed.data;
  if (!isValidIsraeliMobile(normalizePhone(data.phone))) {
    return { ok: false, mode, error: 'phone' };
  }

  const business = await getFirstBusiness();
  if (!business) return { ok: false, mode, error: 'generic' };

  const input: StaffInput = {
    phone: data.phone,
    name: data.name ?? null,
    displayName: data.displayName,
    title: data.title ?? null,
    bio: data.bio ?? null,
    permissionLevel: data.permissionLevel,
    active: data.active,
  };

  if (mode === 'edit' && data.id) {
    const ok = await updateStaffMember(business.id, data.id, input);
    if (!ok) return { ok: false, mode, error: 'generic' };
  } else {
    const res = await createStaffMember(business.id, input);
    if (!res.ok) return { ok: false, mode, error: 'duplicate' };
  }

  revalidatePath('/admin/team');
  return { ok: true, mode };
}

/** הפעלה או השבתה של איש צוות. */
export async function toggleStaffActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const active = checkbox(formData, 'active');
  const business = await getFirstBusiness();
  if (!business) return;
  await setStaffActive(business.id, id, active);
  revalidatePath('/admin/team');
}

/** מחיקת איש צוות (נכשלת בשקט כשמשויכים תורים; אז יש להשבית). */
export async function deleteStaffAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const business = await getFirstBusiness();
  if (!business) return;
  await deleteStaffMember(business.id, id);
  revalidatePath('/admin/team');
}
