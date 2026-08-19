import { prisma } from '@/lib/db';
import type { Prisma, PaymentMethod, SaleStatus } from '@prisma/client';
import { DEFAULT_TZ, addDaysToDateString, localWallTimeToUtc } from '@/lib/time';

const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/;

/** בדיקה שמחרוזת היא תאריך "YYYY-MM-DD" תקין ואמיתי בלוח השנה. */
function isValidDateString(value: string): boolean {
  if (!DATE_STRING_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** חצות מקומי (תחילת היום) של תאריך "YYYY-MM-DD" כרגע UTC. */
function startOfLocalDayUtc(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localWallTimeToUtc(y, m, d, 0, timeZone);
}

/** טווח תאריכים מנורמל לסינון עסקאות: מחרוזות היום וגבולות UTC למחצה-פתוחים. */
export type SaleDateRange = {
  from: string | null;
  to: string | null;
  fromUtc: Date | null;
  toUtc: Date | null;
};

/**
 * בונה טווח תאריכים לסינון עסקאות מתוך קלט גולמי (בדרך כלל מפרמטרי חיפוש).
 * טהור וללא DB, כך שאפשר לבדוק אותו ביחידה. הגבולות נגזרים לפי שעון הקיר של
 * העסק (ברירת מחדל Asia/Jerusalem) ומטופלים כמחצה-פתוחים [fromUtc, toUtc):
 * fromUtc הוא חצות היום הפותח, ו-toUtc הוא חצות היום שאחרי היום הסוגר, כדי
 * לכלול את יום הסיום כולו. קלט לא תקין מנוקה בשקט, וטווח הפוך מתוקן בהחלפה.
 */
export function buildSaleDateRange(
  fromInput?: string | null,
  toInput?: string | null,
  timeZone: string = DEFAULT_TZ,
): SaleDateRange {
  let from = fromInput && isValidDateString(fromInput) ? fromInput : null;
  let to = toInput && isValidDateString(toInput) ? toInput : null;

  // טווח הפוך (מתאריך מאוחר מעד תאריך) — מחליפים כדי לשמור על גבולות תקינים.
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const fromUtc = from ? startOfLocalDayUtc(from, timeZone) : null;
  const toUtc = to ? startOfLocalDayUtc(addDaysToDateString(to, 1), timeZone) : null;

  return { from, to, fromUtc, toUtc };
}

/** גבולות זמן מחצה-פתוחים [fromUtc, toUtc) לשאילתות סינון. */
export type SaleTimeBounds = { fromUtc?: Date | null; toUtc?: Date | null };

/**
 * ניהול עסקאות קופה. עסקה במצב OPEN משמשת כ"סל" מתמשך בצד השרת (static-first,
 * מבוסס server-actions) — כך אין צורך במצב סל בצד הלקוח. כל פעולה מסוננת לפי
 * businessId כדי למנוע גישה חוצת עסקים.
 *
 * הפניה לשירות (serviceId) נשמרת כמזהה רך ללא FK, כדי לא לגעת במודל Service
 * שבבעלות מודול אחר — צילום השם/המחיר נעשה ידנית בזמן ההוספה.
 */

/** חישוב מחדש של סכומי העסקה מתוך הפריטים והתשלומים בפועל. */
async function recalcSale(saleId: string) {
  const [items, payments, sale] = await Promise.all([
    prisma.saleItem.findMany({ where: { saleId }, select: { lineTotalAgorot: true } }),
    prisma.payment.findMany({ where: { saleId }, select: { amountAgorot: true } }),
    prisma.sale.findUnique({ where: { id: saleId }, select: { discountAgorot: true } }),
  ]);

  const subtotalAgorot = items.reduce((sum, i) => sum + i.lineTotalAgorot, 0);
  const discountAgorot = Math.min(sale?.discountAgorot ?? 0, subtotalAgorot);
  const totalAgorot = Math.max(subtotalAgorot - discountAgorot, 0);
  const paidAgorot = payments.reduce((sum, p) => sum + p.amountAgorot, 0);

  return prisma.sale.update({
    where: { id: saleId },
    data: { subtotalAgorot, discountAgorot, totalAgorot, paidAgorot },
  });
}

/** ודא שהעסקה שייכת לעסק ופתוחה לעריכה; מחזיר את הרשומה או null. */
async function getEditableSale(businessId: string, saleId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, businessId, status: 'OPEN' },
    select: { id: true },
  });
}

export type SaleFilter = 'open' | 'completed' | 'all';

/** רשימת עסקאות של העסק לפי מצב וטווח תאריכים, מהחדשה לישנה. */
export function listSales(
  businessId: string,
  filter: SaleFilter = 'open',
  bounds?: SaleTimeBounds,
) {
  const where: Prisma.SaleWhereInput = { businessId };
  if (filter === 'open') where.status = 'OPEN';
  else if (filter === 'completed') where.status = { in: ['COMPLETED', 'REFUNDED'] };

  // סינון לפי מועד פתיחת העסקה (createdAt) — התאריך המוצג והממוין ברשימה.
  if (bounds && (bounds.fromUtc || bounds.toUtc)) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (bounds.fromUtc) createdAt.gte = bounds.fromUtc;
    if (bounds.toUtc) createdAt.lt = bounds.toUtc;
    where.createdAt = createdAt;
  }

  return prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      _count: { select: { items: true, documents: true } },
    },
  });
}

/** עסקה בודדת עם כל הפרטים לתצוגת עריכה/סיכום. */
export function getSaleWithDetails(businessId: string, saleId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, businessId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'asc' } },
      documents: { orderBy: { serialNumber: 'asc' } },
      client: { select: { id: true, name: true, phone: true } },
      appointment: { select: { id: true, startAt: true } },
      staff: { select: { id: true, displayName: true } },
    },
  });
}

export type CreateSaleInput = {
  clientId?: string | null;
  appointmentId?: string | null;
  staffId?: string | null;
  note?: string | null;
};

/** פתיחת עסקה חדשה (מצב OPEN). */
export function createSale(businessId: string, input: CreateSaleInput = {}) {
  return prisma.sale.create({
    data: {
      businessId,
      clientId: input.clientId ?? null,
      appointmentId: input.appointmentId ?? null,
      staffId: input.staffId ?? null,
      note: input.note ?? null,
    },
  });
}

/** הוספת מוצר לעסקה (צילום שם ומחיר מתוך המוצר). */
export async function addProductItem(
  businessId: string,
  saleId: string,
  productId: string,
  quantity = 1,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true, priceAgorot: true },
  });
  if (!product) return false;

  const qty = Math.max(1, Math.floor(quantity));
  await prisma.saleItem.create({
    data: {
      saleId,
      kind: 'PRODUCT',
      productId: product.id,
      nameSnapshot: product.name,
      quantity: qty,
      unitPriceAgorot: product.priceAgorot,
      lineTotalAgorot: product.priceAgorot * qty,
    },
  });
  await recalcSale(saleId);
  return true;
}

/**
 * הוספת שירות לעסקה. מזהה השירות נשמר כהפניה רכה בלבד; השם והמחיר נשלפים
 * ידנית מהעסק ומצולמים לתוך הפריט (ללא include/FK על Service).
 */
export async function addServiceItem(
  businessId: string,
  saleId: string,
  serviceId: string,
  quantity = 1,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true, name: true, priceAgorot: true },
  });
  if (!service) return false;

  const qty = Math.max(1, Math.floor(quantity));
  await prisma.saleItem.create({
    data: {
      saleId,
      kind: 'SERVICE',
      serviceId: service.id,
      nameSnapshot: service.name,
      quantity: qty,
      unitPriceAgorot: service.priceAgorot,
      lineTotalAgorot: service.priceAgorot * qty,
    },
  });
  await recalcSale(saleId);
  return true;
}

/** הוספת פריט חופשי (שם ומחיר ידניים). */
export async function addCustomItem(
  businessId: string,
  saleId: string,
  name: string,
  unitPriceAgorot: number,
  quantity = 1,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const qty = Math.max(1, Math.floor(quantity));
  const unit = Math.max(0, Math.round(unitPriceAgorot));
  await prisma.saleItem.create({
    data: {
      saleId,
      kind: 'CUSTOM',
      nameSnapshot: name,
      quantity: qty,
      unitPriceAgorot: unit,
      lineTotalAgorot: unit * qty,
    },
  });
  await recalcSale(saleId);
  return true;
}

/** עדכון כמות של פריט בעסקה (מסונן לפי העסק). */
export async function updateItemQuantity(
  businessId: string,
  saleId: string,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const item = await prisma.saleItem.findFirst({
    where: { id: itemId, saleId },
    select: { id: true, unitPriceAgorot: true },
  });
  if (!item) return false;

  const qty = Math.max(1, Math.floor(quantity));
  await prisma.saleItem.update({
    where: { id: item.id },
    data: { quantity: qty, lineTotalAgorot: item.unitPriceAgorot * qty },
  });
  await recalcSale(saleId);
  return true;
}

/** הסרת פריט מהעסקה. */
export async function removeItem(
  businessId: string,
  saleId: string,
  itemId: string,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const result = await prisma.saleItem.deleteMany({ where: { id: itemId, saleId } });
  if (result.count === 0) return false;
  await recalcSale(saleId);
  return true;
}

/** קביעת הנחה כוללת על העסקה (באגורות). */
export async function setDiscount(
  businessId: string,
  saleId: string,
  discountAgorot: number,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  await prisma.sale.update({
    where: { id: saleId },
    data: { discountAgorot: Math.max(0, Math.round(discountAgorot)) },
  });
  await recalcSale(saleId);
  return true;
}

/** קישור עסקה ללקוח ו/או לתור (וגם איש צוות). מעדכן רק שדות שהתקבלו. */
export async function setSaleLinks(
  businessId: string,
  saleId: string,
  links: { clientId?: string | null; appointmentId?: string | null; staffId?: string | null },
): Promise<boolean> {
  // עדכון שדות המפתח הזרים ישירות (scalar) — משתמשים בטיפוס Unchecked שחושף
  // את שדות ה-FK, ומסננים לפי businessId כדי לשמור על בידוד בין עסקים.
  const data: Prisma.SaleUncheckedUpdateManyInput = {};
  if (links.clientId !== undefined) data.clientId = links.clientId ?? null;
  if (links.appointmentId !== undefined) data.appointmentId = links.appointmentId ?? null;
  if (links.staffId !== undefined) data.staffId = links.staffId ?? null;

  const result = await prisma.sale.updateMany({
    where: { id: saleId, businessId },
    data,
  });
  return result.count > 0;
}

/** הוספת תשלום כנגד העסקה (תומך תשלום מפוצל). */
export async function addPayment(
  businessId: string,
  saleId: string,
  method: PaymentMethod,
  amountAgorot: number,
  reference?: string | null,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const amount = Math.round(amountAgorot);
  if (amount <= 0) return false;

  await prisma.payment.create({
    data: { saleId, method, amountAgorot: amount, reference: reference ?? null },
  });
  await recalcSale(saleId);
  return true;
}

/** הסרת תשלום מהעסקה. */
export async function removePayment(
  businessId: string,
  saleId: string,
  paymentId: string,
): Promise<boolean> {
  const sale = await getEditableSale(businessId, saleId);
  if (!sale) return false;

  const result = await prisma.payment.deleteMany({ where: { id: paymentId, saleId } });
  if (result.count === 0) return false;
  await recalcSale(saleId);
  return true;
}

/** סגירת עסקה (COMPLETED). מחזיר את העסקה המעודכנת או null אם לא נמצאה/כבר סגורה. */
export async function closeSale(businessId: string, saleId: string) {
  const result = await prisma.sale.updateMany({
    where: { id: saleId, businessId, status: 'OPEN' },
    data: { status: 'COMPLETED', closedAt: new Date() },
  });
  if (result.count === 0) return null;
  return prisma.sale.findUnique({ where: { id: saleId } });
}

/** ביטול עסקה פתוחה (VOIDED). */
export async function voidSale(businessId: string, saleId: string): Promise<boolean> {
  const result = await prisma.sale.updateMany({
    where: { id: saleId, businessId, status: 'OPEN' },
    data: { status: 'VOIDED', closedAt: new Date() },
  });
  return result.count > 0;
}

/** עדכון מצב עסקה ל-REFUNDED (לאחר הפקת זיכוי). */
export async function markSaleRefunded(businessId: string, saleId: string): Promise<boolean> {
  const result = await prisma.sale.updateMany({
    where: { id: saleId, businessId, status: { in: ['COMPLETED'] } },
    data: { status: 'REFUNDED' },
  });
  return result.count > 0;
}

export type SaleStatusValue = SaleStatus;

/** סיכום סגירת קופה: ספירת עסקאות וסכומים לפי אמצעי תשלום בטווח זמן. */
export async function getRegisterSummary(businessId: string, bounds: SaleTimeBounds) {
  // סינון לפי מועד סגירת העסקה (closedAt) בטווח שנבחר. ללא גבולות מסכמים את כל
  // העסקאות הסגורות, אך הקוראים מספקים תמיד טווח (היום כברירת מחדל).
  const closedAt: Prisma.DateTimeFilter = {};
  if (bounds.fromUtc) closedAt.gte = bounds.fromUtc;
  if (bounds.toUtc) closedAt.lt = bounds.toUtc;

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      status: { in: ['COMPLETED', 'REFUNDED'] },
      ...(bounds.fromUtc || bounds.toUtc ? { closedAt } : {}),
    },
    select: { id: true, totalAgorot: true },
  });
  const saleIds = sales.map((s) => s.id);

  const payments = saleIds.length
    ? await prisma.payment.groupBy({
        by: ['method'],
        where: { saleId: { in: saleIds } },
        _sum: { amountAgorot: true },
        _count: { _all: true },
      })
    : [];

  const totalAgorot = sales.reduce((sum, s) => sum + s.totalAgorot, 0);
  const byMethod = payments.map((p) => ({
    method: p.method,
    amountAgorot: p._sum.amountAgorot ?? 0,
    count: p._count._all,
  }));

  return { salesCount: sales.length, totalAgorot, byMethod };
}
