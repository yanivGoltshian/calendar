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

  function openNew() {
    if (!hasServices || columns.length === 0) return;
    const col =
      columns.find((c) => c.staffId === activeStaffId) ?? columns[0];
    const staffName =
      staff.find((s) => s.id === col.staffId)?.displayName ?? col.title;
    setCreateCtx({
      staffId: col.staffId,
      staffName,
      date: col.date,
      time: formatMinutes(gridStartMinute),
    });
  }

  return (
    <section className="cal" dir="rtl">
      <div className="cal-head">
        <span className="ttl">{cal.boardTitle}</span>
        <div className="seg2" role="tablist" aria-label={cal.dayView}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'day'}
            className={view === 'day' ? 'on' : ''}
            onClick={() => go({ view: 'day' })}
          >
            {cal.dayTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'week'}
            className={view === 'week' ? 'on' : ''}
            onClick={() => go({ view: 'week' })}
          >
            {cal.weekTab}
          </button>
        </div>
      </div>

      <div className="cal-nav">
        <button
          type="button"
          className="nv"
          aria-label={view === 'day' ? t.admin.prevDay : cal.prevWeek}
          onClick={() =>
            go({
              date:
                view === 'day'
                  ? addDaysToDateString(date, -1)
                  : addDaysToDateString(weekStart, -7),
            })
          }
        >
          ‹
        </button>
        <button
          type="button"
          className="tdy"
          onClick={() => go({ date: today })}
        >
          {t.admin.today}
        </button>
        <button
          type="button"
          className="nv"
          aria-label={view === 'day' ? t.admin.nextDay : cal.nextWeek}
          onClick={() =>
            go({
              date:
                view === 'day'
                  ? addDaysToDateString(date, 1)
                  : addDaysToDateString(weekStart, 7),
            })
          }
        >
          ›
        </button>
        <span className="lbl">{headerLabel}</span>
        {view === 'week' && staff.length > 0 ? (
          <select
            className="pick"
            aria-label={cal.staffPickerLabel}
            value={activeStaffId}
            onChange={(e) => go({ staffId: e.target.value })}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {hasServices ? (
        <div className="legend">
          {services.map((s) => {
            const color = serviceColor(s.colorIndex);
            return (
              <span key={s.id} className="lg">
                <i style={{ backgroundColor: color.border }} />
                {s.name}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="cal-notice">
          {cal.noServices}{' '}
          <Link href="/admin/services">{cal.noServicesCta}</Link>
        </p>
      )}

      {staff.length === 0 ? (
        <div className="cal-blank">
          <p>{cal.noStaff}</p>
          <Link href="/admin/team" className="newbtn">
            {cal.noStaffCta}
          </Link>
        </div>
      ) : (
        <>
          {appts.length === 0 ? (
            <p className="cal-empty">{cal.empty}</p>
          ) : null}

          <div className="grid">
            <div className="axis">
              <div className="chd axhead" aria-hidden="true" />
              <div className="axbody" style={{ height: bodyHeight }}>
                {hourLines.map((m) => (
                  <div
                    key={m}
                    className="hr"
                    style={{ top: (m - gridStartMinute) * PX_PER_MIN }}
                  >
                    <span dir="ltr">{formatMinutes(m)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cols">
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
                  <div key={col.key} className="col">
                    <div className={`chd${col.isToday ? ' tdy' : ''}`}>
                      <span className="nm">{col.title}</span>
                      {col.subtitle ? (
                        <span className="sub">{col.subtitle}</span>
                      ) : null}
                    </div>
                    <div
                      className={`lane${col.isToday ? ' today' : ''}${
                        hasServices ? ' live' : ''
                      }`}
                      style={{ height: bodyHeight }}
                      onPointerDown={(e) => onDown(e, col)}
                      onPointerMove={(e) => onMove(e, col)}
                      onPointerUp={(e) => onUp(e, col)}
                    >
                      {hourLines.map((m) => (
                        <div
                          key={m}
                          className="hrline"
                          style={{ top: (m - gridStartMinute) * PX_PER_MIN }}
                        />
                      ))}

                      {showDrag && dragH > 0 ? (
                        <div
                          className="dragsel"
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
                            className={`appt${dim ? ' dim' : ''}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setDetail(block)}
                            style={{
                              top,
                              height,
                              insetInlineStart: `${(block.lane / block.laneCount) * 100}%`,
                              width: `calc(${100 / block.laneCount}% - 3px)`,
                              backgroundColor: color.bg,
                              borderColor: color.border,
                              color: color.text,
                            }}
                          >
                            <span className="tm" dir="ltr">
                              {block.startLabel}
                            </span>
                            <span className="nm">
                              {block.clientName || cal.untitledClient}
                            </span>
                            {height > 44 && block.serviceNames ? (
                              <span className="sv">{block.serviceNames}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cal-foot">
            <span className="hintx">{cal.dragHint}</span>
            <button
              type="button"
              className="newbtn"
              onClick={openNew}
              disabled={!hasServices}
            >
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 6v12M6 12h12" />
              </svg>
              {cal.newAppt}
            </button>
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
    </section>
  );
}
