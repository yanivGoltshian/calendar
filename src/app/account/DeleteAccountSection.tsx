'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/admin';
import { t } from '@/i18n';
import { deleteAccount, type DeleteAccountState } from './actions';

const INITIAL: DeleteAccountState = { ok: false };

/**
 * מקטע מחיקת חשבון (חוק הגנת הפרטיות) — חשיפה בשני שלבים + תיבת אישור.
 * מחיקה מוצלחת מפנה בצד השרת לעמוד הבית, ולכן אין כאן מצב "הצלחה".
 */
export function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, INITIAL);

  const errorText =
    state.error === 'owner_blocked'
      ? t.account.deleteOwnerBlocked
      : state.error
        ? t.account.deleteError
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#3A1720] bg-[#160B10] p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-[#F2C0C0]">{t.account.deleteTitle}</h2>
        <p className="text-sm text-[#C7A3A8]">{t.account.deleteIntro}</p>
        <p className="text-xs text-[#9E858A]">{t.account.deleteRetention}</p>
      </div>

      {errorText ? (
        <p className="rounded-lg border border-[#5A2530] bg-[#210E13] px-3 py-2 text-sm text-[#F2A0A0]">
          {errorText}
        </p>
      ) : null}

      {!confirming ? (
        <div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {t.account.deleteReveal}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm text-[#E8ECF3]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D14A5C]"
            />
            <span>{t.account.deleteConfirm}</span>
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={!checked || pending}>
              {pending ? t.account.deleteWorking : t.account.deleteButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setChecked(false);
              }}
            >
              {t.account.deleteCancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
