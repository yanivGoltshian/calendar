'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/admin';
import { t } from '@/i18n';
import { Mascot } from '@/components/brand/Mascot';
import { claimSlot, type ClaimState } from './actions';

const INITIAL: ClaimState = { done: false };

/**
 * כפתור תפיסת המשבצת לעמוד הציבורי /w/<token>.
 * שולח את הטוקן לפעולת השרת claimSlot, ומציג הודעת תוצאה ידידותית לפי המצב
 * (נתפס בהצלחה / ההצעה פגה / מישהו הקדים). לעולם לא זורק — כל מצב מטופל בעברית.
 */
export function ClaimActions({ token, slug }: { token: string; slug?: string | null }) {
  const [state, formAction, pending] = useActionState(claimSlot, INITIAL);

  // הצלחה — התור נתפס ונקבע.
  if (state.done && state.result === 'claimed') {
    return (
      <div
        className="rounded-xl border border-[#2E5A43]/60 bg-[#1F3B2C]/40 px-4 py-4 text-center"
        role="status"
        aria-live="polite"
      >
        <Mascot
          pose="wink"
          circle
          size={56}
          alt={t.waitlist.claim.successTitle}
          className="mb-2 ring-2 ring-[#2E5A43]/60"
        />
        <p className="text-base font-semibold text-[#9BE3B4]">
          {t.waitlist.claim.successTitle}
        </p>
        <p className="mt-1 text-sm text-[#C7D0E0]">{t.waitlist.claim.successBody}</p>
      </div>
    );
  }

  // מצבים סופיים שאינם הצלחה — פגה או נתפס. מציגים הודעה + חזרה לעמוד העסק.
  if (state.result === 'expired' || state.result === 'taken' || state.result === 'not_found') {
    const isTaken = state.result === 'taken';
    return (
      <div
        className="rounded-xl border border-[#16233A] bg-[#08101C] px-4 py-4 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-base font-semibold text-[#E8ECF3]">
          {isTaken ? t.waitlist.claim.takenTitle : t.waitlist.claim.expiredTitle}
        </p>
        <p className="mt-1 text-sm text-[#9AA7BD]">
          {isTaken ? t.waitlist.claim.takenBody : t.waitlist.claim.expiredBody}
        </p>
        {slug ? (
          <a href={`/b/${slug}`} className="mt-3 block">
            <Button variant="secondary" size="md" className="w-full">
              {t.waitlist.claim.backToBusiness}
            </Button>
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="primary" size="md" disabled={pending} className="w-full">
        {pending ? t.waitlist.claim.submitting : t.waitlist.claim.confirmCta}
      </Button>
    </form>
  );
}
