import { prisma } from '@/lib/db';
import { Prisma, type DocumentType } from '@prisma/client';

/**
 * הפקת מסמכים חשבונאיים (קבלה / חשבונית מס / חשבונית מס-קבלה / זיכוי) עם מספור
 * רץ ייחודי לכל עסק+סוג. ההקצאה נעשית בתוך טרנזקציה (max+1), וה-unique constraint
 * על [businessId, type, serialNumber] משמש רשת ביטחון מפני מרוצי הרשמה.
 *
 * חישוב המע"מ הוא "מגולם" (VAT-inclusive): הסכום הכולל כבר כולל מע"מ, ורכיב המע"מ
 * נגזר ממנו לאחור.
 */

const NUMBER_PREFIX: Record<DocumentType, string> = {
  RECEIPT: 'REC',
  TAX_INVOICE: 'INV',
  INVOICE_RECEIPT: 'IR',
  CREDIT_NOTE: 'CR',
};

/** ברירת מחדל לשיעור מע"מ בישראל (18% מ-2025), ב-basis points. */
export const DEFAULT_VAT_RATE_BPS = 1800;

/** פירוק סכום כולל (כולל מע"מ) לרכיב לפני מע"מ ולרכיב המע"מ. */
export function splitVatInclusive(totalAgorot: number, vatRateBps: number) {
  const total = Math.max(0, Math.round(totalAgorot));
  const rate = vatRateBps / 10000;
  const subtotalAgorot = rate > 0 ? Math.round(total / (1 + rate)) : total;
  const vatAgorot = total - subtotalAgorot;
  return { subtotalAgorot, vatAgorot, totalAgorot: total };
}

/** בניית מספר תצוגה לפי סוג המסמך ומספר רץ מרופד באפסים. */
export function formatDocumentNumber(type: DocumentType, serialNumber: number) {
  return `${NUMBER_PREFIX[type]}-${String(serialNumber).padStart(5, '0')}`;
}

export type IssueDocumentInput = {
  type: DocumentType;
  saleId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  totalAgorot: number;
  vatRateBps?: number;
  note?: string | null;
  relatedDocumentId?: string | null;
};

/**
 * הפקת מסמך עם הקצאת מספר רץ טרנזקציונית. בעת התנגשות ייחודיות (P2002) מתבצע
 * ניסיון חוזר עד כמה פעמים.
 */
export async function issueDocument(businessId: string, input: IssueDocumentInput) {
  const vatRateBps = input.vatRateBps ?? DEFAULT_VAT_RATE_BPS;
  const { subtotalAgorot, vatAgorot, totalAgorot } = splitVatInclusive(
    input.totalAgorot,
    vatRateBps,
  );

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.document.findFirst({
          where: { businessId, type: input.type },
          orderBy: { serialNumber: 'desc' },
          select: { serialNumber: true },
        });
        const serialNumber = (last?.serialNumber ?? 0) + 1;

        return tx.document.create({
          data: {
            businessId,
            saleId: input.saleId ?? null,
            type: input.type,
            serialNumber,
            documentNumber: formatDocumentNumber(input.type, serialNumber),
            clientName: input.clientName ?? null,
            clientPhone: input.clientPhone ?? null,
            subtotalAgorot,
            vatRateBps,
            vatAgorot,
            totalAgorot,
            note: input.note ?? null,
            relatedDocumentId: input.relatedDocumentId ?? null,
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < maxAttempts - 1
      ) {
        continue; // התנגשות מספר רץ — ניסיון חוזר
      }
      throw err;
    }
  }
  throw new Error('לא ניתן היה להקצות מספר מסמך רץ לאחר מספר ניסיונות.');
}

export type DocumentFilter = 'all' | DocumentType;

/** רשימת מסמכים של העסק, עם סינון אופציונלי לפי סוג. */
export function listDocuments(businessId: string, filter: DocumentFilter = 'all') {
  return prisma.document.findMany({
    where: { businessId, ...(filter === 'all' ? {} : { type: filter }) },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  });
}

/** מסמך בודד בתוך העסק, כולל קישור לעסקה ולמסמך המקורי (בזיכוי). */
export function getDocument(businessId: string, id: string) {
  return prisma.document.findFirst({
    where: { id, businessId },
    include: {
      sale: {
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'asc' } },
        },
      },
      relatedDocument: { select: { id: true, documentNumber: true, type: true } },
      credits: { select: { id: true, documentNumber: true, totalAgorot: true } },
    },
  });
}

/**
 * הפקת חשבונית זיכוי כנגד מסמך קיים. הזיכוי מצלם את פרטי המקור ומקושר אליו,
 * ומעדכן את העסקה המשויכת (אם קיימת) למצב REFUNDED.
 */
export async function issueCreditNote(
  businessId: string,
  originalDocumentId: string,
  opts: { note?: string | null } = {},
) {
  const original = await prisma.document.findFirst({
    where: { id: originalDocumentId, businessId },
  });
  if (!original) return null;
  if (original.type === 'CREDIT_NOTE') return null; // אין זיכוי על זיכוי

  const credit = await issueDocument(businessId, {
    type: 'CREDIT_NOTE',
    saleId: original.saleId,
    clientName: original.clientName,
    clientPhone: original.clientPhone,
    totalAgorot: original.totalAgorot,
    vatRateBps: original.vatRateBps,
    relatedDocumentId: original.id,
    note: opts.note ?? `זיכוי כנגד מסמך ${original.documentNumber}`,
  });

  if (original.saleId) {
    await prisma.sale.updateMany({
      where: { id: original.saleId, businessId, status: 'COMPLETED' },
      data: { status: 'REFUNDED' },
    });
  }

  return credit;
}
