import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * מודל Product מוגדר מינימלי בכוונה (id, businessId, name, sku, price, category,
 * active). מודול המלאי (Wave 3) יסתעף מכאן ויוסיף שדות/מודלים משלו בתוספת אדיטיבית
 * בלבד — אין כאן לוגיקת ספירת מלאי או תנועות מלאי.
 */

export type ProductInput = {
  name: string;
  sku?: string | null;
  priceAgorot: number;
  category?: string | null;
  active?: boolean;
};

/** רשימת מוצרים של עסק, עם חיפוש חופשי (שם/מק"ט) וסינון פעילים. */
export function listProducts(
  businessId: string,
  opts: { q?: string; activeOnly?: boolean } = {},
) {
  const { q, activeOnly = false } = opts;
  const where: Prisma.ProductWhereInput = { businessId };
  if (activeOnly) where.active = true;

  const term = q?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
    ];
  }

  return prisma.product.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    take: 200,
  });
}

/** מוצרים פעילים בלבד — לבחירה מהירה בקופה. */
export function listActiveProducts(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, active: true },
    orderBy: { name: 'asc' },
  });
}

/** מוצר בודד בתוך העסק. */
export function getProductById(businessId: string, id: string) {
  return prisma.product.findFirst({ where: { id, businessId } });
}

/** יצירת מוצר חדש. */
export function createProduct(businessId: string, data: ProductInput) {
  return prisma.product.create({
    data: {
      businessId,
      name: data.name,
      sku: data.sku ?? null,
      priceAgorot: data.priceAgorot,
      category: data.category ?? null,
      active: data.active ?? true,
    },
  });
}

/** עדכון מוצר (מסונן לפי העסק כדי למנוע גישה חוצת עסקים). */
export async function updateProduct(
  businessId: string,
  id: string,
  data: ProductInput,
) {
  const result = await prisma.product.updateMany({
    where: { id, businessId },
    data: {
      name: data.name,
      sku: data.sku ?? null,
      priceAgorot: data.priceAgorot,
      category: data.category ?? null,
      ...(data.active === undefined ? {} : { active: data.active }),
    },
  });
  return result.count > 0;
}

/** הפעלה או השבתה של מוצר (השבתה = הסתרה מהקופה, ללא מחיקה). */
export async function setProductActive(
  businessId: string,
  id: string,
  active: boolean,
) {
  const result = await prisma.product.updateMany({
    where: { id, businessId },
    data: { active },
  });
  return result.count > 0;
}
