'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/admin';
import { t } from '@/i18n';
import { cancelAppointmentAction, type CancelState } from './actions';

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
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          {t.account.cancelCta}
        </Button>
        {state.error ? (
          <p className="text-xs text-[#F2A0A0]">
            {state.error === 'window_passed'
              ? t.account.cancelWindowPassed
              : t.account.cancelError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <p className="text-sm font-semibold text-[#E8ECF3]">{t.account.cancelConfirmTitle}</p>
      <p className="text-xs text-[#9AA7BD]">{t.account.cancelConfirmBody}</p>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? t.account.cancelling : t.account.cancelConfirm}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t.account.cancelKeep}
        </Button>
      </div>
    </form>
  );
}
