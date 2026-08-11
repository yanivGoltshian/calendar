'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { DocumentType, PaymentMethod } from '@prisma/client';
import { getActiveBusiness } from '@/server/repos/business';
import {
  createSale,
  getSaleWithDetails,
  addProductItem,
  addServiceItem,
  addCustomItem,
  updateItemQuantity,
  removeItem,
  setDiscount,
  setSaleLinks,
  addPayment,
  removePayment,
  closeSale,
  voidSale,
} from '@/server/repos/sales';
import { issueDocument } from '@/server/repos/documents';
import { recordSaleStockDeduction } from '@/server/repos/inventory';
import { shekelsToAgorot } from '@/lib/money';

/**
 * פעולות שרת למודול הקופה. רוב הפעולות הן טפסים פשוטים (void) שמרעננים את
 * העמוד; פתיחת עסקה חדשה והפקת מסמך מנתבות לעמוד היעד. כל פעולה מאמתת קודם את
 * העסק דרך getActiveBusiness ומסננת לפיו.
 */

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BIT', 'BANK_TRANSFER', 'OTHER'];
const DOCUMENT_TYPES: DocumentType[] = ['RECEIPT', 'TAX_INVOICE', 'INVOICE_RECEIPT'];

function salePath(saleId: string) {
  return `/admin/pos/${saleId}`;
}

/** פתיחת עסקה חדשה וניתוב לעורך העסקה. */
export async function createSaleAction(): Promise<void> {
  const business = await getActiveBusiness();
  if (!business) return;
  const sale = await createSale(business.id);
  revalidatePath('/admin/pos');
  redirect(salePath(sale.id));
}

/** הוספת מוצר לעסקה. */
export async function addProductItemAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const productId = String(formData.get('productId') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1) || 1;
  if (!saleId || !productId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await addProductItem(business.id, saleId, productId, quantity);
  revalidatePath(salePath(saleId));
}

/** הוספת שירות לעסקה. */
export async function addServiceItemAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const serviceId = String(formData.get('serviceId') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1) || 1;
  if (!saleId || !serviceId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await addServiceItem(business.id, saleId, serviceId, quantity);
  revalidatePath(salePath(saleId));
}

/** הוספת פריט חופשי (שם ומחיר בשקלים). */
export async function addCustomItemAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const priceShekels = Number(formData.get('price') ?? 0);
  const quantity = Number(formData.get('quantity') ?? 1) || 1;
  if (!saleId || !name || !Number.isFinite(priceShekels) || priceShekels < 0) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await addCustomItem(business.id, saleId, name, shekelsToAgorot(priceShekels), quantity);
  revalidatePath(salePath(saleId));
}

/** עדכון כמות של פריט. */
export async function updateItemQuantityAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const itemId = String(formData.get('itemId') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1) || 1;
  if (!saleId || !itemId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await updateItemQuantity(business.id, saleId, itemId, quantity);
  revalidatePath(salePath(saleId));
}

/** הסרת פריט מהעסקה. */
export async function removeItemAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const itemId = String(formData.get('itemId') ?? '').trim();
  if (!saleId || !itemId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await removeItem(business.id, saleId, itemId);
  revalidatePath(salePath(saleId));
}

/** עדכון הנחה כוללת (בשקלים). */
export async function setDiscountAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const discountShekels = Number(formData.get('discount') ?? 0);
  if (!saleId || !Number.isFinite(discountShekels) || discountShekels < 0) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await setDiscount(business.id, saleId, shekelsToAgorot(discountShekels));
  revalidatePath(salePath(saleId));
}

/** שיוך העסקה ללקוח / תור / איש צוות. ערך ריק => ניתוק. */
export async function setSaleLinksAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  if (!saleId) return;

  const clientId = String(formData.get('clientId') ?? '').trim();
  const appointmentId = String(formData.get('appointmentId') ?? '').trim();
  const staffId = String(formData.get('staffId') ?? '').trim();

  const business = await getActiveBusiness();
  if (!business) return;
  await setSaleLinks(business.id, saleId, {
    clientId: clientId || null,
    appointmentId: appointmentId || null,
    staffId: staffId || null,
  });
  revalidatePath(salePath(saleId));
}

/** הוספת תשלום (סכום בשקלים, אמצעי תשלום מהרשימה). */
export async function addPaymentAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const rawMethod = String(formData.get('method') ?? '').trim();
  const amountShekels = Number(formData.get('amount') ?? 0);
  const reference = String(formData.get('reference') ?? '').trim() || null;
  if (!saleId || !Number.isFinite(amountShekels) || amountShekels <= 0) return;

  const method = (PAYMENT_METHODS as string[]).includes(rawMethod)
    ? (rawMethod as PaymentMethod)
    : 'CASH';

  const business = await getActiveBusiness();
  if (!business) return;
  await addPayment(business.id, saleId, method, shekelsToAgorot(amountShekels), reference);
  revalidatePath(salePath(saleId));
}

/** הסרת תשלום. */
export async function removePaymentAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  const paymentId = String(formData.get('paymentId') ?? '').trim();
  if (!saleId || !paymentId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await removePayment(business.id, saleId, paymentId);
  revalidatePath(salePath(saleId));
}

/** סגירת עסקה. */
export async function closeSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  if (!saleId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  const closed = await closeSale(business.id, saleId);
  // ניכוי מלאי אוטומטי בהשלמת מכירה (מודול המלאי). אידמפוטנטי ולא-זורק —
  // לעולם לא מפיל את סגירת העסקה. הטביעת-רגל היחידה של המלאי בקוד הקופה.
  if (closed) await recordSaleStockDeduction(business.id, saleId);
  revalidatePath(salePath(saleId));
  revalidatePath('/admin/pos');
}

/** ביטול עסקה פתוחה. */
export async function voidSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get('saleId') ?? '').trim();
  if (!saleId) return;

  const business = await getActiveBusiness();
  if (!business) return;
  await voidSale(business.id, saleId);
  revalidatePath('/admin/pos');
  redirect('/admin/pos');
}

const issueSchema = z.object({
  saleId: z.string().trim().min(1),
  type: z.string().trim(),
});

/** הפקת מסמך (קבלה / חשבונית מס / חשבונית מס-קבלה) מתוך עסקה, וניתוב למסמך. */
export async function issueDocumentFromSaleAction(formData: FormData): Promise<void> {
  const parsed = issueSchema.safeParse({
    saleId: formData.get('saleId'),
    type: formData.get('type'),
  });
  if (!parsed.success) return;

  const type = (DOCUMENT_TYPES as string[]).includes(parsed.data.type)
    ? (parsed.data.type as DocumentType)
    : 'RECEIPT';

  const business = await getActiveBusiness();
  if (!business) return;

  const sale = await getSaleWithDetails(business.id, parsed.data.saleId);
  if (!sale) return;

  const doc = await issueDocument(business.id, {
    type,
    saleId: sale.id,
    clientName: sale.client?.name ?? null,
    clientPhone: sale.client?.phone ?? null,
    totalAgorot: sale.totalAgorot,
    note: sale.note,
  });

  revalidatePath(salePath(sale.id));
  revalidatePath('/admin/documents');
  redirect(`/admin/documents/${doc.id}`);
}
