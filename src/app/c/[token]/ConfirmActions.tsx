'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/admin';
import { t } from '@/i18n';
import { submitConfirmation, type ConfirmState } from './actions';

const INITIAL: ConfirmState = { done: false };

/**
 * כפתורי אישור/ביטול הגעה לעמוד הציבורי /c/<token>.
 * שני כפתורי submit באותו טופס, כל אחד שולח decision משלו (name="decision").
 * לאחר הצלחה מוצגת הודעת תוצאה ידידותית במקום הכפתורים.
 */
export function ConfirmActions({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(submitConfirmation, INITIAL);

  if (state.done) {
    const confirmed = state.status === 'CONFIRMED';
    return (
      <div
        className="rounded-xl border border-[#2E5A43]/60 bg-[#1F3B2C]/40 px-4 py-4 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-base font-semibold text-[#9BE3B4]">
          {confirmed
            ? t.reminders.confirm.successConfirmedTitle
            : t.reminders.confirm.successDeclinedTitle}
        </p>
        <p className="mt-1 text-sm text-[#C7D0E0]">
          {confirmed
            ? t.reminders.confirm.successConfirmedBody
            : t.reminders.confirm.successDeclinedBody}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          name="decision"
          value="CONFIRMED"
          variant="primary"
          size="md"
          disabled={pending}
          className="flex-1"
        >
          {pending ? t.reminders.confirm.confirming : t.reminders.confirm.confirmButton}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="DECLINED"
          variant="danger"
          size="md"
          disabled={pending}
          className="flex-1"
        >
          {t.reminders.confirm.declineButton}
        </Button>
      </div>
      {state.error ? (
        <p className="text-center text-sm text-[#F2B8B8]" role="alert">
          {t.reminders.confirm.errorBody}
        </p>
      ) : null}
    </form>
  );
}
