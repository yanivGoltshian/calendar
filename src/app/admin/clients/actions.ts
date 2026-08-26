'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getActiveBusiness } from '@/server/repos/business';
import {
  createClient,
  updateClient,
  setClientBlocked,
  setClientVerification,
  type VerificationLevel,
} from '@/server/repos/clients';
import { isValidIsraeliMobile } from '@/lib/crypto';

const saveSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'name'),
  // טלפון הוא רשות: מותר לשמור לקוח ללא טלפון (משפך אורח / לקוח שיושלם בהמשך).
  // אם נמסר טלפון, הוא חייב להיות נייד ישראלי תקין.
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidIsraeliMobile(v), 'phone')
    .optional()
    .default(''),
  email: z.string().trim().email('email').optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type SaveClientState = {
  ok: boolean;
  mode: 'add' | 'edit';
  error?: string;
};

/** יצירה או עדכון של לקוח. מזהה קיים ב-id => עריכה, אחרת הוספה. */
export async function saveClientAction(
  _prev: SaveClientState,
  formData: FormData,
): Promise<SaveClientState> {
  const rawId = String(formData.get('id') ?? '').trim();
  const mode: 'add' | 'edit' = rawId ? 'edit' : 'add';

  const parsed = saveSchema.safeParse({
    id: rawId || undefined,
    name: formData.get('name'),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || undefined,
    notes: String(formData.get('notes') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'name' || code === 'phone' ? code : 'generic';
    return { ok: false, mode, error };
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, mode, error: 'generic' };

  const data = parsed.data;
  const phoneTrimmed = (data.phone ?? '').trim();
  const payload = {
    name: data.name,
    phone: phoneTrimmed || null,
    email: data.email ?? null,
    notes: data.notes ?? null,
    // כרטיס שנערך ידנית בידי הבעלים: טלפון תקין => "מאומת" (הבעלים ערב),
    // ללא טלפון => "ללא טלפון". כך סימון ההשלמה מתעדכן מיד עם השמירה.
    verificationStatus: (phoneTrimmed ? 'VERIFIED' : 'NONE') as VerificationLevel,
  };

  try {
    if (mode === 'edit' && data.id) {
      const ok = await updateClient(business.id, data.id, payload);
      if (!ok) return { ok: false, mode, error: 'generic' };
      revalidatePath(`/admin/clients/${data.id}`);
    } else {
      await createClient(business.id, payload);
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, mode, error: 'duplicate_phone' };
    }
    return { ok: false, mode, error: 'generic' };
  }

  revalidatePath('/admin/clients');
  return { ok: true, mode };
}

/** חסימה או שחרור של לקוח (טופס פשוט, ללא מצב). */
export async function toggleClientBlockedAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const blocked = String(formData.get('blocked') ?? '') === '1';
  if (!id) return;

  const business = await getActiveBusiness();
  if (!business) return;

  await setClientBlocked(business.id, id, blocked);
  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
}

/**
 * סימון ידני של רמת אימות הזהות של לקוח בידי בעל העסק ("מאומת" / "טופל").
 * טופס פשוט ללא מצב, בדומה לחסימה. משמש להשלמת לקוחות שהוזמנו כאורחים.
 */
export async function setClientVerificationAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const raw = String(formData.get('verificationStatus') ?? '').trim();
  const allowed: VerificationLevel[] = ['VERIFIED', 'UNVERIFIED', 'NONE'];
  if (!id || !allowed.includes(raw as VerificationLevel)) return;

  const business = await getActiveBusiness();
  if (!business) return;

  await setClientVerification(business.id, id, raw as VerificationLevel);
  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
}
