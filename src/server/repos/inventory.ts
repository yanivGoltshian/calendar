import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, StockMovementType } from '@prisma/client';

/**
 * שכבת המלאי (Wave 3, אפוס L). צורכת את model Product המשותף עם הקופה בקריאה בלבד
 * ומוסיפה מעליו שלושה מודלים אדיטיביים: StockLevel (כמות זמינה + סף), StockMovement
 * (יומן תנועות) ו-LowStockAlert (התראות מלאי נמוך). כל שאילתה מסוננת לפי businessId,
 * כל הכמויות מספרים שלמים וכל העלויות באגורות (Int), עקבי ל-priceAgorot של הקופה.
 */

type Tx = PrismaClient | Prisma.TransactionClient;

/** מוצר עם נתוני המלאי הנלווים לתצוגה (כמות, סף, מצב מעקב/נמוך). */
export type StockRow = {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  active: boolean;
  priceAgorot: number;
  tracked: boolean; // האם קיימת רשומת StockLevel למוצר
  quantity: number;
  lowStockThreshold: number;
  isLow: boolean; // סף פעיל והכמות אינה מעליו
};

type ListOpts = { q?: string; category?: string; activeOnly?: boolean };

/** רשימת מוצרי העסק עם נתוני המלאי שלהם (מוצר ללא רשומת מלאי נחשב לא-במעקב). */
export async function listStockLevels(
  businessId: string,
  opts: ListOpts = {},
): Promise<StockRow[]> {
  const { q, category, activeOnly = false } = opts;
  const where: Prisma.ProductWhereInput = { businessId };
  if (activeOnly) where.active = true;
  if (category) where.category = category;

  const term = q?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { stockLevel: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: 500,
  });

  return products.map((p) => {
    const level = p.stockLevel;
    const quantity = level?.quantity ?? 0;
    const threshold = level?.lowStockThreshold ?? 0;
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku ?? null,
      category: p.category ?? null,
      active: p.active,
      priceAgorot: p.priceAgorot,
      tracked: level != null,
      quantity,
      lowStockThreshold: threshold,
      isLow: threshold > 0 && quantity <= threshold,
    };
  });
}

/** נתוני המלאי של מוצר בודד (או null אם המוצר אינו של העסק). */
export async function getStockRow(
  businessId: string,
  productId: string,
): Promise<StockRow | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, businessId },
    include: { stockLevel: true },
  });
  if (!p) return null;
  const level = p.stockLevel;
  const quantity = level?.quantity ?? 0;
  const threshold = level?.lowStockThreshold ?? 0;
  return {
    productId: p.id,
    name: p.name,
    sku: p.sku ?? null,
    category: p.category ?? null,
    active: p.active,
    priceAgorot: p.priceAgorot,
    tracked: level != null,
    quantity,
    lowStockThreshold: threshold,
    isLow: threshold > 0 && quantity <= threshold,
  };
}

/** רשימת הקטגוריות הקיימות אצל העסק (לסינון ולקיבוץ). */
export async function listCategories(businessId: string): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { businessId, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category!).filter((c) => c.trim().length > 0);
}

/** התראות מלאי נמוך פתוחות (resolvedAt = null), עם פרטי המוצר, החדשות בראש. */
export function listOpenLowStockAlerts(businessId: string) {
  return prisma.lowStockAlert.findMany({
    where: { businessId, resolvedAt: null },
    include: { product: { select: { name: true, sku: true, category: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/** תנועות מלאי אחרונות (אופציונלית לפי מוצר), החדשות בראש. */
export function listStockMovements(
  businessId: string,
  opts: { productId?: string; limit?: number } = {},
) {
  const { productId, limit = 50 } = opts;
  return prisma.stockMovement.findMany({
    where: { businessId, ...(productId ? { productId } : {}) },
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * הערכת מצב התראת מלאי נמוך למוצר לאחר שינוי כמות. פותחת התראה חדשה כשהכמות יורדת
 * אל הסף או מתחתיו ואין התראה פתוחה; סוגרת התראה פתוחה כשהכמות חוזרת מעל הסף.
 * פועלת בתוך אותה טרנזקציה של השינוי.
 */
async function evaluateLowStockAlert(
  tx: Tx,
  businessId: string,
  productId: string,
  quantity: number,
  threshold: number,
): Promise<void> {
  const open = await tx.lowStockAlert.findFirst({
    where: { businessId, productId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const isLow = threshold > 0 && quantity <= threshold;

  if (isLow && !open) {
    await tx.lowStockAlert.create({
      data: { businessId, productId, quantityAtAlert: quantity, threshold },
    });
  } else if (!isLow && open) {
    await tx.lowStockAlert.update({
      where: { id: open.id },
      data: { resolvedAt: new Date() },
    });
  }
}

type AdjustInput = {
  type: StockMovementType;
  quantityDelta: number; // חיובי = כניסה, שלילי = יציאה
  unitCostAgorot?: number | null;
  note?: string | null;
  saleId?: string | null;
};

/**
 * שינוי מלאי יחסי: יוצר StockMovement, מעדכן/יוצר את StockLevel של המוצר ומעריך
 * מחדש התראת מלאי נמוך — הכול בטרנזקציה אחת. מאמת שהמוצר שייך לעסק.
 */
export async function adjustStock(
  businessId: string,
  productId: string,
  input: AdjustInput,
): Promise<StockRow | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) return null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockLevel.findUnique({ where: { productId } });
    const threshold = existing?.lowStockThreshold ?? 0;
    const nextQuantity = (existing?.quantity ?? 0) + input.quantityDelta;

    await tx.stockMovement.create({
      data: {
        businessId,
        productId,
        type: input.type,
        quantityDelta: input.quantityDelta,
        unitCostAgorot: input.unitCostAgorot ?? null,
        note: input.note ?? null,
        saleId: input.saleId ?? null,
      },
    });

    const level = await tx.stockLevel.upsert({
      where: { productId },
      create: { businessId, productId, quantity: nextQuantity, lowStockThreshold: threshold },
      update: { quantity: nextQuantity },
    });

    await evaluateLowStockAlert(tx, businessId, productId, level.quantity, level.lowStockThreshold);
    return getStockRowFromLevel(businessId, productId, tx);
  });
}

/**
 * קביעת ספירת מלאי מוחלטת (ספירת מלאי ידנית). מחשב את ההפרש מול הכמות הנוכחית
 * ורושם תנועת ADJUSTMENT תואמת. אם אין הפרש — לא נרשמת תנועה, רק הבטחת רשומה.
 */
export async function setStockCount(
  businessId: string,
  productId: string,
  newQuantity: number,
  note?: string | null,
): Promise<StockRow | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) return null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockLevel.findUnique({ where: { productId } });
    const threshold = existing?.lowStockThreshold ?? 0;
    const current = existing?.quantity ?? 0;
    const delta = newQuantity - current;

    if (delta !== 0) {
      await tx.stockMovement.create({
        data: {
          businessId,
          productId,
          type: 'ADJUSTMENT',
          quantityDelta: delta,
          note: note ?? null,
        },
      });
    }

    const level = await tx.stockLevel.upsert({
      where: { productId },
      create: { businessId, productId, quantity: newQuantity, lowStockThreshold: threshold },
      update: { quantity: newQuantity },
    });

    await evaluateLowStockAlert(tx, businessId, productId, level.quantity, level.lowStockThreshold);
    return getStockRowFromLevel(businessId, productId, tx);
  });
}

/** עדכון סף התראת המלאי הנמוך של מוצר, והערכה מחדש של התראה פתוחה. */
export async function setLowStockThreshold(
  businessId: string,
  productId: string,
  threshold: number,
): Promise<StockRow | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) return null;

  return prisma.$transaction(async (tx) => {
    const level = await tx.stockLevel.upsert({
      where: { productId },
      create: { businessId, productId, quantity: 0, lowStockThreshold: threshold },
      update: { lowStockThreshold: threshold },
    });

    await evaluateLowStockAlert(tx, businessId, productId, level.quantity, level.lowStockThreshold);
    return getStockRowFromLevel(businessId, productId, tx);
  });
}

/** קריאת StockRow בתוך טרנזקציה (מונע קריאה כפולה מחוץ לטרנזקציה). */
async function getStockRowFromLevel(
  businessId: string,
  productId: string,
  tx: Tx,
): Promise<StockRow | null> {
  const p = await tx.product.findFirst({
    where: { id: productId, businessId },
    include: { stockLevel: true },
  });
  if (!p) return null;
  const level = p.stockLevel;
  const quantity = level?.quantity ?? 0;
  const threshold = level?.lowStockThreshold ?? 0;
  return {
    productId: p.id,
    name: p.name,
    sku: p.sku ?? null,
    category: p.category ?? null,
    active: p.active,
    priceAgorot: p.priceAgorot,
    tracked: level != null,
    quantity,
    lowStockThreshold: threshold,
    isLow: threshold > 0 && quantity <= threshold,
  };
}

/**
 * ניכוי מלאי אוטומטי בעקבות השלמת מכירה בקופה. אידמפוטנטי ולא-זורק: הקופה קוראת
 * לו אחרי closeSale, והוא אף פעם לא מפיל את זרימת הקופה. לכל פריט מכירה עם productId
 * נרשמת תנועת SALE שלילית פעם אחת בלבד (זיהוי כפילות לפי saleId+productId).
 */
export async function recordSaleStockDeduction(
  businessId: string,
  saleId: string,
): Promise<void> {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      select: { id: true },
    });
    if (!sale) return;

    const items = await prisma.saleItem.findMany({
      where: { saleId, productId: { not: null }, quantity: { gt: 0 } },
      select: { productId: true, quantity: true },
    });
    if (items.length === 0) return;

    // צבירה לפי מוצר — כמה שורות של אותו מוצר מתנקזות לניכוי אחד.
    const perProduct = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) continue;
      perProduct.set(item.productId, (perProduct.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, qty] of perProduct) {
      // אידמפוטנטיות: אם כבר קיימת תנועת SALE לעסקה זו ולמוצר זה — דלג.
      const already = await prisma.stockMovement.findFirst({
        where: { businessId, productId, saleId, type: 'SALE' },
        select: { id: true },
      });
      if (already) continue;

      await adjustStock(businessId, productId, {
        type: 'SALE',
        quantityDelta: -qty,
        saleId,
      });
    }
  } catch {
    // ניכוי מלאי לעולם לא מפיל את סגירת העסקה בקופה — נכשל בשקט.
  }
}
