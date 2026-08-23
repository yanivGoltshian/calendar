'use client';

import { useActionState, useState } from 'react';
import { t } from '@/i18n';
import { cancelAppointmentAction, type CancelState } from '@/app/account/actions';

/** תצוגת תור בודד למקטע "שלום .." — כל השדות מחושבים בשרת (כולל אזור זמן). */
export type ReturningAppointmentView = {
  id: string;
  title: string;
  staffLabel: string;
  whenLabel: string;
  googleUrl: string;
  canCancel: boolean;
};

type Props = {
  name: string;
  slug: string;
  appointments: ReturningAppointmentView[];
};

const INITIAL: CancelState = { ok: false };

/** שורת תור בודדת: פרטים + הוספה ליומן Google + ביטול דו-שלבי. */
function AppointmentRow({
  appt,
  slug,
  addToCalendar,
  addToCalendarAria,
}: {
  appt: ReturningAppointmentView;
  slug: string;
  addToCalendar: string;
  addToCalendarAria: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelAppointmentAction, INITIAL);

  if (state.ok) return null;

  return (
    <li className="rounded-2xl border border-[#e7ddcd] bg-[#fbf7f0] p-4">
      <p className="text-base font-black text-[color:var(--c-ink,#1b1715)]">{appt.title}</p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--c-muted,#6e655f)]">
        {appt.staffLabel}
      </p>
      <p className="mt-2 text-sm font-bold tabular-nums text-[#a06c63]">{appt.whenLabel}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={appt.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={addToCalendarAria}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--c-brand,#b0855f)] bg-white px-3.5 py-2 text-sm font-bold text-[color:var(--c-brand,#b0855f)] transition hover:bg-[color:var(--c-brand,#b0855f)] hover:text-white"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          {addToCalendar}
        </a>

        {appt.canCancel && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center rounded-full border border-[#e2c9c4] bg-white px-3.5 py-2 text-sm font-semibold text-[#a06c63] transition hover:bg-[#f4e9e6]"
          >
            {t.account.cancelCta}
          </button>
        ) : null}
      </div>

      {appt.canCancel && confirming ? (
        <form action={formAction} className="mt-3 rounded-xl border border-[#e2c9c4] bg-white p-3">
          <input type="hidden" name="appointmentId" value={appt.id} />
          <input type="hidden" name="revalidate" value={`/b/${slug}`} />
          <p className="text-sm font-bold text-[color:var(--c-ink,#1b1715)]">
            {t.account.cancelConfirmTitle}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--c-muted,#6e655f)]">
            {t.account.cancelConfirmBody}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[#c0504a] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#a83f3a] disabled:opacity-60"
            >
              {pending ? t.account.cancelling : t.account.cancelConfirm}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-[#e7ddcd] bg-white px-3.5 py-2 text-sm font-semibold text-[color:var(--c-ink,#1b1715)] transition hover:bg-[#fbf7f0] disabled:opacity-60"
            >
              {t.account.cancelKeep}
            </button>
          </div>
          {state.error && state.error !== 'unauthorized' ? (
            <p className="mt-2 text-xs font-semibold text-[#c0504a]">
              {state.error === 'window_passed'
                ? t.account.cancelWindowPassed
                : t.account.cancelError}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

/**
 * מקטע "שלום .." ללקוח מזוהה — מוצג בעמוד העסק הציבורי בין ווידג'ט קביעת התור
 * למקטע המבצעים. מציג את התורים הקרובים של הלקוח בעסק זה עם הוספה ליומן וביטול.
 */
export default function ReturningCustomer({ name, slug, appointments }: Props) {
  const r = t.premiumLanding.clinic.returning;
  if (appointments.length === 0) return null;

  return (
    <section id="lp-hello" className="mt-8 scroll-mt-24">
      <div className="relative overflow-hidden rounded-[26px] border border-[#e7ddcd] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(40,28,18,0.5)] sm:p-[26px]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#c6a86a,#c08f86,#b0855f)]" />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-black text-[color:var(--c-ink,#1b1715)]">
            {r.greeting} {name}
          </h2>
          <span className="inline-flex items-center rounded-full bg-[#c08f86]/15 px-3.5 py-1.5 text-xs font-extrabold text-[#a06c63]">
            {r.subtitle}
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {appointments.map((appt) => (
            <AppointmentRow
              key={appt.id}
              appt={appt}
              slug={slug}
              addToCalendar={r.addToCalendar}
              addToCalendarAria={r.addToCalendarAria}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
