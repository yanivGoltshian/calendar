'use client';

import { useActionState, useState } from 'react';
import { t } from '@/i18n';
import { cancelAppointmentAction, type CancelState } from './actions';
import { btnDangerGhostSm, btnDangerSm, btnWhiteSm } from './premium';

const INITIAL: CancelState = { ok: false };

/** לחצן ביטול תור עם אישור פנימי (שני שלבים) ומצב טעינה/שגיאה. */
export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelAppointmentAction, INITIAL);

  // לאחר ביטול מוצלח המסך עובר revalidate והתור נעלם מהרשימה הקרובה.
  if (state.ok) return null;

  if (!confirming) {
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" className={btnDangerGhostSm} onClick={() => setConfirming(true)}>
          {t.account.cancelCta}
        </button>
        {state.error ? (
          <p className="text-xs text-[#a06c63]">
            {state.error === 'window_passed'
              ? t.account.cancelWindowPassed
              : t.account.cancelError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-2xl border border-[#e2c9c3] bg-[#fbf3f1] p-3"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <p className="text-sm font-bold text-[#a06c63]">{t.account.cancelConfirmTitle}</p>
      <p className="text-xs text-[#6e655f]">{t.account.cancelConfirmBody}</p>
      <div className="flex items-center gap-2">
        <button type="submit" className={btnDangerSm} disabled={pending}>
          {pending ? t.account.cancelling : t.account.cancelConfirm}
        </button>
        <button
          type="button"
          className={btnWhiteSm}
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t.account.cancelKeep}
        </button>
      </div>
    </form>
  );
}
