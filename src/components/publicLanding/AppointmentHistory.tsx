'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  historyPageSchema,
  type HistoryCursor,
  type HistoryPage,
} from '@/lib/appointmentHistory';
import { formatAgorot } from '@/lib/money';
import { t } from '@/i18n';

const buttonClass =
  'rounded-full border border-[color:var(--c-brand,#b0855f)] bg-[color:var(--c-surface,#ffffff)] px-3.5 py-2 text-sm font-bold text-[color:var(--biz-text,#334155)]';

export default function AppointmentHistory({ slug }: { slug: string }) {
  const r = t.premiumLanding.clinic.returning;
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'load' | 'session' | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(
    async (cursor: HistoryCursor | null) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      setLoading(true);
      setError(null);
      const query = cursor
        ? `?${new URLSearchParams({ before: cursor.startAt, beforeId: cursor.id })}`
        : '';
      try {
        const response = await fetch(
          `/api/public/b/${encodeURIComponent(slug)}/history${query}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setPage(null);
          setError('session');
          return;
        }
        if (!response.ok) throw new Error(`appointment_history_http_${response.status}`);
        const next = historyPageSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setPage((previous) => ({
          appointments:
            cursor && previous
              ? [
                  ...new Map(
                    [...previous.appointments, ...next.appointments].map((a) => [
                      a.id,
                      a,
                    ]),
                  ).values(),
                ]
              : next.appointments,
          nextCursor: next.nextCursor,
        }));
      } catch (failure) {
        if (!controller.signal.aborted) {
          console.error('appointment_history_fetch_failed', failure);
          setError('load');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    setPage(null);
    void load(null);
    return () => activeRequest.current?.abort();
  }, [load]);

  return (
    <div aria-busy={loading}>
      {page?.appointments.length ? (
        <>
          <p className="mb-3 mt-4 text-xs text-[color:var(--c-muted,#6e655f)]">
            {r.newestFirst}
          </p>
          <ul className="flex flex-col gap-3">
            {page.appointments.map((appointment) => {
              const amount = appointment.paidAgorot ?? appointment.bookedPriceAgorot;
              const status =
                appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
                  ? r.pastStatus
                  : appointment.status === 'ARRIVED'
                    ? r.arrivedStatus
                    : appointment.status === 'NO_SHOW'
                      ? r.noShowStatus
                      : t.admin.statuses[appointment.status];
              const statusClass =
                appointment.status === 'DONE'
                  ? 'bg-[#e8f0e9] text-[#38664f]'
                  : appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW'
                    ? 'bg-[#f5e7e3] text-[#9a4f48]'
                    : 'bg-[#ece6df] text-[#706052]';
              return (
                <li
                  key={appointment.id}
                  data-history-card
                  className="rounded-2xl border border-[color:var(--c-border,#e7ddcd)] bg-[color:var(--c-surface-muted,#fbf7f0)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-black text-[color:var(--c-ink,#1b1715)]">
                        {appointment.title}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[color:var(--c-muted,#6e655f)]">
                        {appointment.staffLabel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-[color:var(--c-accent-text,#7f4f48)]">
                      {appointment.dateLabel}
                      <br />
                      <bdi>{appointment.timeLabel}</bdi>
                    </p>
                    <div className="shrink-0 text-left text-xs text-[color:var(--c-muted,#6e655f)]">
                      <p>
                        {appointment.paidAgorot !== null ? r.paidAmount : r.bookedPrice}
                      </p>
                      {amount !== null ? (
                        <p className="text-xl font-extrabold tabular-nums text-[color:var(--c-ink,#1b1715)]">
                          <bdi>{formatAgorot(amount)}</bdi>
                        </p>
                      ) : (
                        <p className="max-w-32 font-bold">{r.missingPrice}</p>
                      )}
                      <p>
                        {appointment.paidAgorot !== null
                          ? r.paymentRecorded
                          : r.paymentUnrecorded}
                      </p>
                      {appointment.paidAgorot !== null &&
                      appointment.bookedPriceAgorot !== null ? (
                        <p>
                          {r.bookedPrice}:{' '}
                          <bdi>{formatAgorot(appointment.bookedPriceAgorot)}</bdi>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <details className="mt-4 text-xs leading-relaxed text-[color:var(--c-muted,#6e655f)]">
            <summary className="cursor-pointer font-bold text-[color:var(--c-accent-text,#7f4f48)]">
              {r.amountHelp}
            </summary>
            <p className="mt-2">{r.amountHelpBody}</p>
          </details>
        </>
      ) : page && !loading && !error ? (
        <div className="px-3 py-8 text-center text-sm text-[color:var(--c-muted,#6e655f)]">
          <p className="font-bold text-[color:var(--c-ink,#1b1715)]">{r.historyEmpty}</p>
          <p className="mt-1">{r.historyEmptyBody}</p>
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 text-sm text-[color:var(--c-muted,#6e655f)]">
          <p>{error === 'session' ? r.sessionExpired : r.historyError}</p>
          {error === 'session' ? (
            <a
              className={`${buttonClass} mt-2 inline-block`}
              href={`/login?redirect=${encodeURIComponent(`/b/${slug}`)}`}
            >
              {r.signIn}
            </a>
          ) : (
            <button
              type="button"
              disabled={loading}
              className={`${buttonClass} mt-2`}
              onClick={() => void load(page?.nextCursor ?? null)}
            >
              {r.retry}
            </button>
          )}
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="mt-4 text-sm text-[color:var(--c-muted,#6e655f)]">
          {r.historyLoading}
        </p>
      ) : null}
      {page?.nextCursor && !error ? (
        <button
          type="button"
          className={`${buttonClass} mt-4 disabled:opacity-60`}
          disabled={loading}
          onClick={() => void load(page.nextCursor)}
        >
          {r.loadMore}
        </button>
      ) : null}
    </div>
  );
}
