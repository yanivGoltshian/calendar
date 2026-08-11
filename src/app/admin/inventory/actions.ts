'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getFirstBusiness } from '@/server/repos/business';
import { adjustStock, setStockCount, setLowStockThreshold } from '@/server/repos/inventory';
import { shekelsToAgorot } from '@/lib/money';

/**
 * פעולות שרת למודול המלאי (בבעלות admin/inventory). כל הכמויות מספרים שלמים
 * ועלויות באגורות (מוזנות בשקלים ומומרות). כל פעולה מאמתת קודם את העסק דרך
 * getFirstBusiness ומסתמכת על שכבת ה-repo לאימות שייכות המוצר לעסק (מחזירה null
 * אם המוצר אינו של העסק). לוגיקת המלאי כולה מרוכזת ב-repos/inventory.
 */

const MODES = ['count', 'purchase', 'adjustment', 'return'] as const;

export type StockMovementState = { ok: boolean; error?: string };

const movementSchema = z.object({
  productId: z.string().trim().min(1, 'product'),
  mode: z.enum(MODES),
  amount: z.coerce.number({ invalid_type_error: 'amount' }).int('amount'),
  unitCost: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(200).optional(),
});

/**
 * רישום תנועת מלאי לפי סוג הפעולה:
 * count → קביעת ספירה מוחלטת; purchase/return → כניסה חיובית; adjustment → הפרש (גם שלילי).
 */
export async function saveStockMovementAction(
  _prev: StockMovementState,
  formData: FormData,
): Promise<StockMovementState> {
  const rawUnit = String(formData.get('unitCost') ?? '').trim();
  const parsed = movementSchema.safeParse({
    productId: formData.get('productId'),
    mode: formData.get('mode'),
    amount: formData.get('amount'),
    unitCost: rawUnit || undefined,
    note: String(formData.get('note') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { ok: false, error: code === 'amount' || code === 'product' ? code : 'generic' };
  }

  const { productId, mode, amount, unitCost, note } = parsed.data;

  // אימות כמות לפי סוג הפעולה.
  if (mode === 'count' && amount < 0) return { ok: false, error: 'amount' };
  if ((mode === 'purchase' || mode === 'return') && amount <= 0) return { ok: false, error: 'amount' };
  if (mode === 'adjustment' && amount === 0) return { ok: false, error: 'amount' };

  const business = await getFirstBusiness();
  if (!business) return { ok: false, error: 'generic' };

  try {
    let row;
    if (mode === 'count') {
      row = await setStockCount(business.id, productId, amount, note ?? null);
    } else if (mode === 'purchase') {
      row = await adjustStock(business.id, productId, {
        type: 'PURCHASE',
        quantityDelta: amount,
        unitCostAgorot: unitCost != null ? shekelsToAgorot(unitCost) : null,
        note: note ?? null,
      });
    } else if (mode === 'return') {
      row = await adjustStock(business.id, productId, {
        type: 'RETURN',
        quantityDelta: amount,
        note: note ?? null,
      });
    } else {
      row = await adjustStock(business.id, productId, {
        type: 'ADJUSTMENT',
        quantityDelta: amount,
        note: note ?? null,
      });
    }
    if (!row) return { ok: false, error: 'product' };
  } catch {
    return { ok: false, error: 'generic' };
  }

  revalidatePath('/admin/inventory');
  return { ok: true };
}

/** עדכון סף התראת מלאי נמוך (טופס פשוט ללא מצב). ריק => 0 (ללא התראה). */
export async function saveThresholdAction(formData: FormData): Promise<void> {
  const productId = String(formData.get('productId') ?? '').trim();
  if (!productId) return;

  const raw = String(formData.get('threshold') ?? '').trim();
  const parsed = z.coerce.number().int().min(0).safeParse(raw === '' ? 0 : raw);
  if (!parsed.success) return;

  const business = await getFirstBusiness();
  if (!business) return;

  await setLowStockThreshold(business.id, productId, parsed.data);
  revalidatePath('/admin/inventory');
}
