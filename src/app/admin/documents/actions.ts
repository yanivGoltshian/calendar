'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getActiveBusiness } from '@/server/repos/business';
import { issueCreditNote } from '@/server/repos/documents';

/**
 * פעולות שרת למודול המסמכים. הפקת חשבונית זיכוי כנגד מסמך קיים — טופס פשוט (void)
 * שמנתב למסמך הזיכוי החדש בהצלחה, או מרענן את מסמך המקור אם ההפקה נכשלה.
 */

const creditSchema = z.object({
  documentId: z.string().trim().min(1),
  note: z.string().trim().max(500).optional(),
});

/** הפקת חשבונית זיכוי כנגד מסמך מקור. */
export async function issueCreditNoteAction(formData: FormData): Promise<void> {
  const parsed = creditSchema.safeParse({
    documentId: formData.get('documentId'),
    note: String(formData.get('note') ?? '').trim() || undefined,
  });
  if (!parsed.success) return;

  const business = await getActiveBusiness();
  if (!business) return;

  const credit = await issueCreditNote(business.id, parsed.data.documentId, {
    note: parsed.data.note ?? null,
  });

  revalidatePath('/admin/documents');
  revalidatePath(`/admin/documents/${parsed.data.documentId}`);

  if (credit) {
    revalidatePath(`/admin/documents/${credit.id}`);
    redirect(`/admin/documents/${credit.id}`);
  }
}
