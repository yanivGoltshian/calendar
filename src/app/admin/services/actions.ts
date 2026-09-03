'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getActiveBusiness } from '@/server/repos/business';
import {
  createService,
  updateService,
  deleteService,
  setServiceHidden,
  setServiceStaff,
  listServices,
  seedServicesForBusiness,
} from '@/server/repos/services';
import { shouldSeedServiceTemplates } from '@/server/onboarding/serviceTemplates';
import { shekelsToAgorot } from '@/lib/money';

const saveSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'name'),
  description: z.string().trim().max(500).optional(),
  durationMin: z.coerce.number().int().positive('duration'),
  priceShekels: z.coerce.number().min(0, 'price'),
  hidePrice: z.boolean(),
  hideDuration: z.boolean(),
  hidden: z.boolean(),
});

export type SaveServiceState = {
  ok: boolean;
  mode: 'add' | 'edit';
  error?: string;
};

function checkbox(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

function revalidatePublic(slug: string) {
  revalidatePath('/admin/services');
  revalidatePath(`/b/${slug}`);
  revalidatePath(`/b/${slug}/book`);
}

/** יצירה או עדכון של שירות (חתימת useActionState). */
export async function saveServiceAction(
  _prev: SaveServiceState,
  formData: FormData,
): Promise<SaveServiceState> {
  const rawId = String(formData.get('id') || '').trim();
  const mode: 'add' | 'edit' = rawId ? 'edit' : 'add';

  const parsed = saveSchema.safeParse({
    id: rawId || undefined,
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    durationMin: formData.get('durationMin'),
    priceShekels: formData.get('priceShekels'),
    hidePrice: checkbox(formData, 'hidePrice'),
    hideDuration: checkbox(formData, 'hideDuration'),
    hidden: checkbox(formData, 'hidden'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    const error =
      issue === 'name'
        ? 'name'
        : issue === 'duration'
          ? 'duration'
          : issue === 'price'
            ? 'price'
            : 'bad_request';
    return { ok: false, mode, error };
  }

  const data = parsed.data;
  const business = await getActiveBusiness();
  if (!business) return { ok: false, mode, error: 'no_business' };

  const payload = {
    name: data.name,
    description: data.description ?? null,
    durationMin: data.durationMin,
    priceAgorot: shekelsToAgorot(data.priceShekels),
    hidePrice: data.hidePrice,
    hideDuration: data.hideDuration,
    hidden: data.hidden,
  };

  const staffIds = formData.getAll('staffIds').map((v) => String(v));

  if (mode === 'edit' && data.id) {
    const updated = await updateService(business.id, data.id, payload);
    if (!updated) return { ok: false, mode, error: 'not_found' };
    await setServiceStaff(business.id, data.id, staffIds);
  } else {
    const created = await createService(business.id, payload);
    await setServiceStaff(business.id, created.id, staffIds);
  }

  revalidatePublic(business.slug);
  return { ok: true, mode };
}

/** מחיקת שירות (פעולת טופס פשוטה). */
export async function deleteServiceAction(formData: FormData) {
  const id = String(formData.get('id') || '').trim();
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  await deleteService(business.id, id);
  revalidatePublic(business.slug);
}

/** החלפת מצב הצגה/הסתרה מהעמוד הציבורי (פעולת טופס פשוטה). */
export async function toggleServiceHiddenAction(formData: FormData) {
  const id = String(formData.get('id') || '').trim();
  const hidden = checkbox(formData, 'hidden');
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  await setServiceHidden(business.id, id, hidden);
  revalidatePublic(business.slug);
}

/**
 * טעינה חד-פעמית של שירותי תבנית לפי סוג העסק — לעסקים קיימים שנוצרו לפני מנגנון
 * האונבורדינג ולכן נותרו בלי שירותים. משתמש חוזר בלוגיקת הזריעה הקיימת
 * (seedServicesForBusiness) בלי לשכפל את מערך התבניות.
 *
 * מוגבל לעסק הפעיל של הבעלים המאומת בלבד (getActiveBusiness גוזר בעלות מהמייל).
 * שומר בטיחות כפול: זורע רק כאשר לעסק אין שירותים כלל (בדיקה עם listServices כאן,
 * ובדיקה נוספת בתוך seedServicesForBusiness), ולכן לחיצה חוזרת לא תיצור כפילויות.
 */
export async function loadServiceTemplatesAction() {
  const business = await getActiveBusiness();
  if (!business) return;

  const existing = await listServices(business.id);
  let created = 0;
  if (shouldSeedServiceTemplates(existing.length)) {
    created = await seedServicesForBusiness(business.id, business.type);
  }

  // רענון היומן ומסך השירותים כדי שהתצוגה תתעדכן מיד לאחר הזריעה.
  revalidatePath('/admin');
  revalidatePath('/admin/services');
  // זריעת שירותי תבנית משנה את השירותים המוצגים בעמודי הציבור — רענון על-פי דרישה.
  if (created > 0) {
    revalidatePath(`/b/${business.slug}`);
    revalidatePath(`/b/${business.slug}/book`);
  }

  // נשארים במסך השירותים כדי שהבעלים יערוך או ימחק את שירותי התבנית מיד.
  redirect(created > 0 ? '/admin/services?seeded=1' : '/admin/services');
}
