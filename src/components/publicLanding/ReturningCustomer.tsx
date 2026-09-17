'use client';

import { useActionState, useCallback, useEffect, useId, useState } from 'react';
import { t } from '@/i18n';
import { cancelAppointmentAction, type CancelState } from '@/app/account/actions';
import AppointmentHistory from './AppointmentHistory';

/** Server-formatted upcoming appointment, including business-local time. */
export type ReturningAppointmentView = {
  id: string;
  title: string;
  staffLabel: string;
  whenLabel: string;
  googleUrl: string;
  canCancel: boolean;
};

type Props = {
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
  onCancelled,
}: {
  appt: ReturningAppointmentView;
  slug: string;
  addToCalendar: string;
  addToCalendarAria: string;
  onCancelled: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelAppointmentAction, INITIAL);
  useEffect(() => {
    if (state.ok) onCancelled(appt.id);
  }, [state.ok, appt.id, onCancelled]);

  if (state.ok) return null;

  return (
    <li className="rounded-2xl border border-[color:var(--c-border,#e7ddcd)] bg-[color:var(--c-surface-muted,#fbf7f0)] p-4">
      <p className="text-base font-black text-[color:var(--c-ink,#1b1715)]">
        {appt.title}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--c-muted,#6e655f)]">
        {appt.staffLabel}
      </p>
      <p className="mt-2 text-sm font-bold tabular-nums text-[color:var(--c-accent-text,#7f4f48)]">
        {appt.whenLabel}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={appt.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={addToCalendarAria}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--c-brand,#b0855f)] bg-[color:var(--c-surface,#ffffff)] px-3.5 py-2 text-sm font-bold text-[color:var(--biz-text,#334155)] transition hover:bg-[color:var(--c-brand,#b0855f)] hover:text-[color:var(--c-on-brand,#ffffff)]"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          {addToCalendar}
        </a>

        {appt.canCancel && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center rounded-full border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            {t.account.cancelCta}
          </button>
        ) : null}
      </div>

      {appt.canCancel && confirming ? (
        <form
          action={formAction}
          className="mt-3 rounded-xl border border-[#e2c9c4] bg-white p-3"
        >
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
              className="rounded-full border border-[color:var(--c-border,#e7ddcd)] bg-[color:var(--c-surface,#ffffff)] px-3.5 py-2 text-sm font-semibold text-[color:var(--c-ink,#1b1715)] transition hover:bg-[color:var(--c-surface-muted,#fbf7f0)] disabled:opacity-60"
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
 * Personal appointments remain client-loaded, scoped to this business.
 */
export default function ReturningCustomer({ slug, appointments }: Props) {
  const r = t.premiumLanding.clinic.returning;
  const id = useId();
  const [tab, setTab] = useState<'upcoming' | 'history'>(
    appointments.length ? 'upcoming' : 'history',
  );
  const [historyVisited, setHistoryVisited] = useState(appointments.length === 0);
  const [cancelled, setCancelled] = useState<string[]>([]);
  const onCancelled = useCallback((appointmentId: string) => {
    setCancelled((previous) =>
      previous.includes(appointmentId) ? previous : [...previous, appointmentId],
    );
  }, []);
  const upcoming = appointments.filter(
    (appointment) => !cancelled.includes(appointment.id),
  );
  const selectTab = (next: 'upcoming' | 'history') => {
    setTab(next);
    if (next === 'history') setHistoryVisited(true);
  };

  return (
    <section id="lp-hello" aria-label={r.title} className="mt-8 scroll-mt-24">
      <div
        className="relative overflow-hidden rounded-[26px] border border-[color:var(--c-border,#e7ddcd)] bg-[color:var(--c-surface,#ffffff)] p-5 sm:p-[26px]"
        style={{ boxShadow: '0 30px 60px -30px var(--c-shadow, rgba(40,28,18,0.5))' }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background:
              'linear-gradient(90deg, var(--c-gold), var(--c-accent), var(--c-brand))',
          }}
        />
        <div
          role="tablist"
          aria-label={r.title}
          className="flex border-b border-[color:var(--c-border,#e7ddcd)]"
        >
          {(['upcoming', 'history'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${id}-${key}`}
              aria-controls={`${id}-${key}-panel`}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => selectTab(key)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                  return;
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'upcoming'
                    : event.key === 'End'
                      ? 'history'
                      : tab === 'upcoming'
                        ? 'history'
                        : 'upcoming';
                selectTab(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
              className={`flex-1 border-b-[3px] px-2 py-3 text-sm font-bold sm:flex-none sm:px-5 ${
                tab === key
                  ? 'border-[color:var(--c-brand-strong,#8c6748)] text-[color:var(--c-ink,#1b1715)]'
                  : 'border-transparent text-[color:var(--c-muted,#6e655f)]'
              }`}
            >
              {key === 'upcoming' ? r.upcomingTab : r.historyTab}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${id}-upcoming-panel`}
          aria-labelledby={`${id}-upcoming`}
          hidden={tab !== 'upcoming'}
        >
          <ul className="mt-4 flex flex-col gap-3">
            {upcoming.map((appt) => (
              <AppointmentRow
                key={appt.id}
                appt={appt}
                slug={slug}
                addToCalendar={r.addToCalendar}
                addToCalendarAria={r.addToCalendarAria}
                onCancelled={onCancelled}
              />
            ))}
          </ul>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-[color:var(--c-muted,#6e655f)]">
              {r.empty}
            </p>
          ) : null}
        </div>
        <div
          role="tabpanel"
          id={`${id}-history-panel`}
          aria-labelledby={`${id}-history`}
          hidden={tab !== 'history'}
        >
          {historyVisited ? <AppointmentHistory key={slug} slug={slug} /> : null}
        </div>
      </div>
    </section>
  );
}
