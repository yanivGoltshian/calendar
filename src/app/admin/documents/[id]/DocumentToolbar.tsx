'use client';

import { t } from '@/i18n';
import { issueCreditNoteAction } from '../actions';

type Props = {
  documentId: string;
  isCreditNote: boolean;
};

/**
 * סרגל פעולות למסמך: הדפסה וזיכוי. מוסתר בהדפסה (no-print).
 * כפתור הזיכוי מוצג רק כאשר המסמך אינו חשבונית זיכוי.
 */
export default function DocumentToolbar({ documentId, isCreditNote }: Props) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {t.admin.documents.print}
      </button>

      {!isCreditNote ? (
        <form
          action={issueCreditNoteAction}
          onSubmit={(e) => {
            if (!window.confirm(t.admin.documents.creditConfirm)) e.preventDefault();
          }}
        >
          <input type="hidden" name="documentId" value={documentId} />
          <button
            type="submit"
            className="rounded-lg border border-[#d6c8b4] px-4 py-2 text-sm font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea]"
          >
            {t.admin.documents.issueCreditNote}
          </button>
        </form>
      ) : null}
    </div>
  );
}
