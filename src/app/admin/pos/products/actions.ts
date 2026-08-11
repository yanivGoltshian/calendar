'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getFirstBusiness } from '@/server/repos/business';
import { createProduct, updateProduct, setProductActive } from '@/server/repos/products';
import { shekelsToAgorot } from '@/lib/money';

/**
 * פעולות שרת לניהול מוצרים (בבעלות מודול הקופה). המחיר מוזן בשקלים ונשמר באגורות.
 * המחיר מגלם מע"מ (VAT-inclusive), בהתאם לחישוב בהפקת המסמכים.
 */

const saveSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'name'),
  sku: z.string().trim().max(64).optional(),
  price: z.coerce.number({ invalid_type_error: 'price' }).min(0, 'price'),
  category: z.string().trim().max(64).optional(),
  active: z.boolean().optional(),
});

export type SaveProductState = {
  ok: boolean;
  mode: 'add' | 'edit';
  error?: string;
};

/** יצירה או עדכון של מוצר. מזהה קיים ב-id => עריכה, אחרת הוספה. */
export async function saveProductAction(
  _prev: SaveProductState,
  formData: FormData,
): Promise<SaveProductState> {
  const rawId = String(formData.get('id') ?? '').trim();
  const mode: 'add' | 'edit' = rawId ? 'edit' : 'add';

  const parsed = saveSchema.safeParse({
    id: rawId || undefined,
    name: formData.get('name'),
    sku: String(formData.get('sku') ?? '').trim() || undefined,
    price: formData.get('price'),
    category: String(formData.get('category') ?? '').trim() || undefined,
    active: formData.get('active') != null ? formData.get('active') === 'on' : undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'name' || code === 'price' ? code : 'generic';
    return { ok: false, mode, error };
  }

  const business = await getFirstBusiness();
  if (!business) return { ok: false, mode, error: 'generic' };

  const data = parsed.data;
  const payload = {
    name: data.name,
    sku: data.sku ?? null,
    priceAgorot: shekelsToAgorot(data.price),
    category: data.category ?? null,
    active: data.active,
  };

  try {
    if (mode === 'edit' && data.id) {
      const ok = await updateProduct(business.id, data.id, payload);
      if (!ok) return { ok: false, mode, error: 'generic' };
    } else {
      await createProduct(business.id, payload);
    }
  } catch {
    return { ok: false, mode, error: 'generic' };
  }

  revalidatePath('/admin/pos/products');
  return { ok: true, mode };
}

/** הפעלה או השבתה של מוצר (טופס פשוט ללא מצב). */
export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const active = String(formData.get('active') ?? '') === '1';
  if (!id) return;

  const business = await getFirstBusiness();
  if (!business) return;

  await setProductActive(business.id, id, active);
  revalidatePath('/admin/pos/products');
}
