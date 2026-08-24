'use client';

import { useActionState, useState } from 'react';
import { t } from '@/i18n';
import { deleteAccount, type DeleteAccountState } from './actions';
import { btnDanger, btnDangerGhost, btnWhite, premiumCard } from './premium';

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
    <section className={`${premiumCard} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-extrabold text-[#a06c63]">{t.account.deleteTitle}</h2>
        <p className="text-sm text-[#6e655f]">{t.account.deleteIntro}</p>
        <p className="text-xs text-[#9a8f84]">{t.account.deleteRetention}</p>
      </div>

      {errorText ? (
        <p className="rounded-xl border border-[#e2c9c3] bg-[#fbf3f1] px-3 py-2 text-sm text-[#a06c63]">
          {errorText}
        </p>
      ) : null}

      {!confirming ? (
        <div>
          <button type="button" className={btnDangerGhost} onClick={() => setConfirming(true)}>
            {t.account.deleteReveal}
          </button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm text-[#2c2522]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#c08f86]"
            />
            <span>{t.account.deleteConfirm}</span>
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className={btnDanger} disabled={!checked || pending}>
              {pending ? t.account.deleteWorking : t.account.deleteButton}
            </button>
            <button
              type="button"
              className={btnWhite}
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setChecked(false);
              }}
            >
              {t.account.deleteCancel}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
