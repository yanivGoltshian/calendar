'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from './icons';

export type BookingLabels = {
  title: string;
  pill: string;
  treatmentLabel: string;
  staffLabel: string;
  staffAny: string;
  dateLabel: string;
  timeLabel: string;
  weekdays: readonly string[];
  months: readonly string[];
  prevMonth: string;
  nextMonth: string;
  loadingSlots: string;
  noSlots: string;
  summaryEmpty: string;
  cta: string;
  note: string;
};

type StaffMember = { id: string; displayName: string };
type Slot = { label: string; startAtUtc: string; endAtUtc: string };

type Props = {
  slug: string;
  services: { id: string; name: string }[];
  staff?: StaffMember[];
  bookHref: string;
  labels: BookingLabels;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}
// תאריך מקומי בפורמט YYYY-MM-DD (חודש באינדקס 0).
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

// ווידג'ט קביעת תור אינטראקטיבי: לוח חודש אמיתי + שעות פנויות אמיתיות מ-/api/availability.
// הבחירה נישאת לאשף המאובטח דרך פרמטרים בקישור, תוך שמירה על העיצוב היוקרתי כפי שהוא.
export default function LandingBooking({ slug, services, staff, bookHref, labels }: Props) {
  const serviceChips = services.slice(0, 5);
  const staffList = staff ?? [];
  const staffChips: StaffMember[] = [{ id: '', displayName: labels.staffAny }, ...staffList.slice(0, 3)];

  const now = useMemo(() => new Date(), []);
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  const [serviceId, setServiceId] = useState(serviceChips[0]?.id ?? '');
  const [selectedStaffId, setSelectedStaffId] = useState(''); // '' = כל הצוות
  const [date, setDate] = useState(todayStr);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');

  // כשלא נבחר איש צוות ספציפי ("כל הצוות") — שולחים את איש הצוות הראשון כברירת מחדל לשאילתה.
  const queryStaffId = selectedStaffId || staffList[0]?.id || '';

  // שליפת שעות פנויות אמיתיות בכל שינוי של טיפול / צוות / תאריך.
  useEffect(() => {
    if (!serviceId || !queryStaffId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setTime('');
    fetch('/api/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, staffId: queryStaffId, serviceIds: [serviceId], date }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots(d?.ok ? (d.slots as Slot[]) : []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId, queryStaffId, date]);

  // תאי לוח החודש בתצוגה, כולל ריפוד תחילת השבוע והשבתת ימים שחלפו.
  const cells = useMemo(() => {
    const startOffset = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr: { key: string; day: number; dateStr: string | null; past: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) arr.push({ key: `blank-${i}`, day: 0, dateStr: null, past: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = ymd(view.y, view.m, d);
      arr.push({ key: ds, day: d, dateStr: ds, past: ds < todayStr });
    }
    return arr;
  }, [view, todayStr]);

  const atCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  function shiftMonth(delta: number) {
    setView((v) => {
      const dt = new Date(v.y, v.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
  }

  const treatmentName = serviceChips.find((s) => s.id === serviceId)?.name ?? '';
  const whoName = selectedStaffId
    ? staffList.find((s) => s.id === selectedStaffId)?.displayName ?? labels.staffAny
    : labels.staffAny;

  function formatDateLabel(ds: string) {
    const [y, m, d] = ds.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    return `${labels.weekdays[wd]} ${pad(d)}/${pad(m)}`;
  }

  const summary =
    treatmentName && time
      ? `${treatmentName} · ${formatDateLabel(date)} · ${time} · ${whoName}`
      : labels.summaryEmpty;

  // קישור עמוק אל האשף המאובטח: השירות, איש הצוות, התאריך והשעה שנבחרו.
  const params = new URLSearchParams();
  if (serviceId) params.set('service', serviceId);
  if (queryStaffId) params.set('staffId', queryStaffId);
  if (date) params.set('date', date);
  if (time) params.set('time', time);
  const bookQuery = params.toString();
  const ctaHref = bookQuery ? `${bookHref}?${bookQuery}` : bookHref;

  return (
    <section id="lp-book" className="relative z-[5] -mt-14 scroll-mt-24 sm:-mt-16">
      <div className="relative overflow-hidden rounded-[26px] border border-[#e7ddcd] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(40,28,18,0.5)] sm:p-[26px]">
        {/* פס עליון בגרדיאנט זהב→אקו→מותג — חתימת הכרטיס הצף */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#c6a86a,#c08f86,#b0855f)]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-[color:var(--c-ink,#1b1715)]">{labels.title}</h2>
          <span className="inline-flex items-center rounded-full bg-[#c08f86]/15 px-3.5 py-1.5 text-xs font-extrabold text-[#a06c63]">
            {labels.pill}
          </span>
        </div>

        <div className="mt-[18px] grid grid-cols-1 gap-[18px] min-[821px]:grid-cols-[1.1fr_1fr_1fr]">
          {/* טיפול + צוות */}
          <div>
            <p className="mb-2 text-[0.82rem] font-extrabold text-[color:var(--c-muted,#6e655f)]">{labels.treatmentLabel}</p>
            <div className="flex flex-wrap gap-2">
              {serviceChips.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                    serviceId === s.id
                      ? 'border-transparent bg-[color:var(--c-brand,#b0855f)] text-white'
                      : 'border-[#e7ddcd] bg-[#fbf7f0] text-[#4a423c] hover:border-[color:var(--c-brand,#b0855f)]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-4 text-[0.82rem] font-extrabold text-[color:var(--c-muted,#6e655f)]">{labels.staffLabel}</p>
            <div className="flex flex-wrap gap-2">
              {staffChips.map((m) => (
                <button
                  key={m.id || 'any'}
                  type="button"
                  onClick={() => setSelectedStaffId(m.id)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                    selectedStaffId === m.id
                      ? 'border-transparent bg-[color:var(--c-brand,#b0855f)] text-white'
                      : 'border-[#e7ddcd] bg-[#fbf7f0] text-[#4a423c] hover:border-[color:var(--c-brand,#b0855f)]'
                  }`}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          </div>

          {/* תאריך — לוח מיני דקורטיבי */}
          <div>
            <p className="mb-2 text-[0.82rem] font-extrabold text-[color:var(--c-muted,#6e655f)]">{labels.dateLabel}</p>
            <div className="rounded-2xl border border-[#e7ddcd] bg-[#fbf7f0] p-3">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={atCurrentMonth}
                  aria-label={labels.prevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--c-ink,#1b1715)]/70 transition enabled:hover:bg-white disabled:opacity-30"
                >
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </button>
                <span className="text-sm font-bold text-[color:var(--c-ink,#1b1715)]">
                  {labels.months[view.m]} {view.y}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label={labels.nextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--c-ink,#1b1715)]/70 transition hover:bg-white"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {labels.weekdays.map((d) => (
                  <span key={d} className="py-1 text-[11px] font-bold text-[#9a8f82]">
                    {d}
                  </span>
                ))}
                {cells.map((c) =>
                  c.dateStr === null ? (
                    <span key={c.key} className="h-8" />
                  ) : (
                    <button
                      key={c.key}
                      type="button"
                      disabled={c.past}
                      onClick={() => setDate(c.dateStr as string)}
                      className={`flex h-8 items-center justify-center rounded-lg text-sm transition ${
                        date === c.dateStr
                          ? 'bg-[color:var(--c-brand,#b0855f)] font-bold text-white'
                          : c.past
                            ? 'cursor-default text-[color:var(--c-ink,#1b1715)]/25'
                            : 'text-[color:var(--c-ink,#1b1715)]/80 hover:bg-white'
                      }`}
                    >
                      {c.day}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* שעה */}
          <div>
            <p className="mb-2 text-[0.82rem] font-extrabold text-[color:var(--c-muted,#6e655f)]">{labels.timeLabel}</p>
            {slotsLoading ? (
              <p className="py-3 text-sm text-[color:var(--c-ink,#1b1715)]/50">{labels.loadingSlots}</p>
            ) : slots.length === 0 ? (
              <p className="py-3 text-sm text-[color:var(--c-ink,#1b1715)]/50">{labels.noSlots}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startAtUtc}
                    type="button"
                    dir="ltr"
                    onClick={() => setTime(slot.label)}
                    className={`rounded-[10px] border px-3.5 py-2 text-sm font-bold tabular-nums transition ${
                      time === slot.label
                        ? 'border-transparent bg-[#c08f86] text-white'
                        : 'border-[#e7ddcd] bg-white text-[#4a423c] hover:border-[color:var(--c-brand,#b0855f)]'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-[#e7ddcd] pt-4">
          <p className="text-[0.9rem] text-[color:var(--c-muted,#6e655f)]">{summary}</p>
          <Link
            href={ctaHref}
            className="group inline-flex items-center gap-2 rounded-full bg-[#c08f86] px-8 py-3 text-base font-bold text-white shadow-elevated transition hover:-translate-y-0.5 hover:bg-[#a06c63]"
          >
            {labels.cta}
            <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
          </Link>
        </div>
      </div>
      <p className="mt-3 px-1 text-center text-xs text-[color:var(--c-ink,#1b1715)]/55">{labels.note}</p>
    </section>
  );
}
