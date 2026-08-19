'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/i18n';
import { addDaysToDateString, formatMinutes } from '@/lib/time';
import { serviceColor } from './serviceColors';
import {
  CreateAppointmentModal,
  AppointmentDetailModal,
} from './CalendarModals';
import type {
  ApptBlock,
  CalendarColumn,
  CalendarView,
  ServiceOption,
  StaffOption,
} from './calendar-types';

const cal = t.admin.calendar;

const PX_PER_MIN = 0.9;
const AXIS_W = 56;
const COL_W = 158;
const MIN_BLOCK_H = 22;

type Props = {
  view: CalendarView;
  date: string;
  weekStart: string;
  today: string;
  headerLabel: string;
  columns: CalendarColumn[];
  appts: ApptBlock[];
  services: ServiceOption[];
  staff: StaffOption[];
  activeStaffId: string;
  gridStartMinute: number;
  gridEndMinute: number;
  granularity: number;
  defaultDurationMin: number;
};

type Placed = ApptBlock & { lane: number; laneCount: number };

/** אריזת חפיפות ל"מסלולים" (עמודות משנה) בתוך אשכולות חופפים. */
function packColumn(items: ApptBlock[]): Placed[] {
  const sorted = [...items].sort(
    (a, b) =>
      a.startMinute - b.startMinute ||
      a.startMinute + a.durationMin - (b.startMinute + b.durationMin),
  );
  const result: Placed[] = [];
  let cluster: { block: ApptBlock; end: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const { block, end } of cluster) {
      let lane = laneEnds.findIndex((e) => e <= block.startMinute);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = end;
      laneOf.set(block.id, lane);
    }
    const laneCount = laneEnds.length || 1;
    for (const { block } of cluster) {
      result.push({ ...block, lane: laneOf.get(block.id) ?? 0, laneCount });
    }
    cluster = [];
  };

  for (const block of sorted) {
    const end = block.startMinute + block.durationMin;
    if (cluster.length && block.startMinute >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    cluster.push({ block, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return result;
}

export default function CalendarBoard({
  view,
  date,
  weekStart,
  today,
  headerLabel,
  columns,
  appts,
  services,
  staff,
  activeStaffId,
  gridStartMinute,
  gridEndMinute,
  granularity,
  defaultDurationMin,
}: Props) {
  const router = useRouter();
  const [createCtx, setCreateCtx] = useState<{
    staffId: string;
    staffName: string;
    date: string;
    time: string;
  } | null>(null);
  const [detail, setDetail] = useState<ApptBlock | null>(null);
  const [drag, setDrag] = useState<{
    colKey: string;
    startMin: number;
    curMin: number;
  } | null>(null);

  const totalMinutes = Math.max(gridEndMinute - gridStartMinute, granularity);
  const bodyHeight = totalMinutes * PX_PER_MIN;
  const hasServices = services.length > 0;

  function go(next: { view?: CalendarView; date?: string; staffId?: string }) {
    const p = new URLSearchParams();
    p.set('view', next.view ?? view);
    p.set('date', next.date ?? date);
    const sid = next.staffId ?? activeStaffId;
    if (sid) p.set('staffId', sid);
    router.push(`/admin?${p.toString()}`);
  }

  function snap(minute: number): number {
    const s = Math.round(minute / granularity) * granularity;
    return Math.max(gridStartMinute, Math.min(gridEndMinute, s));
  }

  function minuteFromEvent(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return snap(gridStartMinute + (e.clientY - rect.top) / PX_PER_MIN);
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>, col: CalendarColumn) {
    if (e.button !== 0 || !hasServices) return;
    const m = minuteFromEvent(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ colKey: col.key, startMin: m, curMin: m });
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>, col: CalendarColumn) {
    if (!drag || drag.colKey !== col.key) return;
    setDrag({ ...drag, curMin: minuteFromEvent(e) });
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>, col: CalendarColumn) {
    if (!drag || drag.colKey !== col.key) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    let start = Math.min(drag.startMin, drag.curMin);
    let end = Math.max(drag.startMin, drag.curMin);
    if (end - start < granularity) {
      end = Math.min(start + defaultDurationMin, gridEndMinute);
      start = Math.max(end - defaultDurationMin, gridStartMinute);
    }
    setDrag(null);
    const staffName =
      staff.find((s) => s.id === col.staffId)?.displayName ?? col.title;
    setCreateCtx({
      staffId: col.staffId,
      staffName,
      date: col.date,
      time: formatMinutes(start),
    });
  }

  const hourLines: number[] = [];
  const firstHour = Math.ceil(gridStartMinute / 60) * 60;
  for (let m = firstHour; m <= gridEndMinute; m += 60) hourLines.push(m);

  const otherView: CalendarView = view === 'day' ? 'week' : 'day';

  return (
    <div dir="rtl">
      {/* סרגל ניווט */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => go({ view: 'day' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'day'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cal.dayView}
          </button>
          <button
            type="button"
            onClick={() => go({ view: 'week' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'week'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cal.weekView}
          </button>
        </div>

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              go({
                date:
                  view === 'day'
                    ? addDaysToDateString(date, -1)
                    : addDaysToDateString(weekStart, -7),
              })
            }
            aria-label={view === 'day' ? t.admin.prevDay : cal.prevWeek}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => go({ date: today })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.admin.today}
          </button>
          <button
            type="button"
            onClick={() =>
              go({
                date:
                  view === 'day'
                    ? addDaysToDateString(date, 1)
                    : addDaysToDateString(weekStart, 7),
              })
            }
            aria-label={view === 'day' ? t.admin.nextDay : cal.nextWeek}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50"
          >
            ‹
          </button>
        </div>

        <span className="text-base font-semibold text-slate-900">
          {headerLabel}
        </span>

        {view === 'week' && staff.length > 0 ? (
          <select
            aria-label={cal.staffPickerLabel}
            value={activeStaffId}
            onChange={(e) => go({ staffId: e.target.value })}
            className="ms-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* מקרא צבעים */}
      {hasServices ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-xs font-medium text-slate-400">
            {cal.legendTitle}:
          </span>
          {services.map((s) => {
            const color = serviceColor(s.colorIndex);
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: color.bg, border: `1px solid ${color.border}` }}
                />
                {s.name}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mb-3 text-sm text-amber-700">
          {cal.noServices}{' '}
          <Link
            href="/admin/services"
            className="font-semibold text-amber-900 underline underline-offset-2 transition hover:text-amber-950"
          >
            {cal.noServicesCta}
          </Link>
        </p>
      )}

      {staff.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <p>{cal.noStaff}</p>
          <Link
            href="/admin/team"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {cal.noStaffCta}
          </Link>
        </div>
      ) : (
        <>
          {appts.length === 0 ? (
            <p className="mb-2 text-sm text-slate-400">{cal.empty}</p>
          ) : hasServices ? (
            <p className="mb-2 text-xs text-slate-400">{cal.dragHint}</p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="min-w-max">
              {/* כותרות עמודות */}
              <div className="flex border-b border-slate-200">
                <div style={{ width: AXIS_W }} className="shrink-0" />
                {columns.map((col) => (
                  <div
                    key={col.key}
                    style={{ width: COL_W }}
                    className="shrink-0 border-s border-slate-100 px-2 py-2 text-center"
                  >
                    <div
                      className={`text-sm font-semibold ${
                        col.isToday ? 'text-brand-600' : 'text-slate-800'
                      }`}
                    >
                      {col.title}
                    </div>
                    {col.subtitle ? (
                      <div className="text-xs text-slate-400">{col.subtitle}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* גוף היומן */}
              <div className="flex">
                {/* ציר שעות */}
                <div style={{ width: AXIS_W, height: bodyHeight }} className="relative shrink-0">
                  {hourLines.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 -translate-y-1/2 pe-1 text-left text-[11px] text-slate-400"
                      style={{ top: (m - gridStartMinute) * PX_PER_MIN }}
                    >
                      <span dir="ltr">{formatMinutes(m)}</span>
                    </div>
                  ))}
                </div>

                {/* עמודות */}
                {columns.map((col) => {
                  const placed = packColumn(
                    appts.filter((a) => a.columnKey === col.key),
                  );
                  const showDrag = drag && drag.colKey === col.key;
                  const dragTop =
                    (Math.min(drag?.startMin ?? 0, drag?.curMin ?? 0) -
                      gridStartMinute) *
                    PX_PER_MIN;
                  const dragH =
                    Math.abs((drag?.curMin ?? 0) - (drag?.startMin ?? 0)) *
                    PX_PER_MIN;

                  return (
                    <div
                      key={col.key}
                      style={{ width: COL_W, height: bodyHeight }}
                      className={`relative shrink-0 border-s border-slate-100 ${
                        col.isToday ? 'bg-brand-50/30' : ''
                      } ${hasServices ? 'cursor-crosshair' : ''}`}
                      onPointerDown={(e) => onDown(e, col)}
                      onPointerMove={(e) => onMove(e, col)}
                      onPointerUp={(e) => onUp(e, col)}
                    >
                      {hourLines.map((m) => (
                        <div
                          key={m}
                          className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                          style={{ top: (m - gridStartMinute) * PX_PER_MIN }}
                        />
                      ))}

                      {showDrag && dragH > 0 ? (
                        <div
                          className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-dashed border-brand-400 bg-brand-100/50"
                          style={{ top: dragTop, height: Math.max(dragH, 4) }}
                        />
                      ) : null}

                      {placed.map((block) => {
                        const color = serviceColor(block.colorIndex);
                        const top =
                          (block.startMinute - gridStartMinute) * PX_PER_MIN;
                        const height = Math.max(
                          block.durationMin * PX_PER_MIN,
                          MIN_BLOCK_H,
                        );
                        const dim =
                          block.status === 'CANCELLED' ||
                          block.status === 'NO_SHOW';
                        return (
                          <button
                            key={block.id}
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setDetail(block)}
                            className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-right text-[11px] leading-tight shadow-sm transition hover:shadow ${
                              dim ? 'opacity-60' : ''
                            }`}
                            style={{
                              top,
                              height,
                              insetInlineStart: `${(block.lane / block.laneCount) * 100}%`,
                              width: `calc(${100 / block.laneCount}% - 2px)`,
                              backgroundColor: color.bg,
                              borderColor: color.border,
                              borderInlineStartWidth: 3,
                              color: color.text,
                            }}
                          >
                            <span dir="ltr" className="block font-semibold">
                              {block.startLabel}
                            </span>
                            <span className="block truncate font-medium">
                              {block.clientName || cal.untitledClient}
                            </span>
                            {height > 44 && block.serviceNames ? (
                              <span className="block truncate opacity-80">
                                {block.serviceNames}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {createCtx ? (
        <CreateAppointmentModal
          staffId={createCtx.staffId}
          staffName={createCtx.staffName}
          date={createCtx.date}
          time={createCtx.time}
          services={services}
          onClose={() => setCreateCtx(null)}
        />
      ) : null}

      {detail ? (
        <AppointmentDetailModal appt={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  );
}
