'use client';

import { useState } from 'react';
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
  summaryEmpty: string;
  cta: string;
  note: string;
};

type Props = {
  services: { id: string; name: string }[];
  staff?: string[];
  bookHref: string;
  labels: BookingLabels;
};

// לוח חודש דקורטיבי קבוע — הווידג'ט הוא חלון ראווה יוקרתי, והאישור הסופי
// מתבצע באשף קביעת התור המאובטח. היום המודגש והמשבצות ממחישים את החוויה.
const CAL_DAYS = [
  { n: 28, muted: true },
  { n: 29, muted: true },
  { n: 30, muted: true },
  { n: 1 },
  { n: 2 },
  { n: 3 },
  { n: 4 },
  { n: 5 },
  { n: 6 },
  { n: 7, active: true },
  { n: 8 },
  { n: 9 },
  { n: 10 },
  { n: 11 },
  { n: 12 },
  { n: 13 },
  { n: 14 },
  { n: 15 },
  { n: 16 },
  { n: 17 },
  { n: 18 },
];

const TIME_SLOTS = ['10:00', '10:45', '11:30', '13:00', '16:15', '17:00', '18:30'];

export default function LandingBooking({ services, staff, bookHref, labels }: Props) {
  const treatments = services.slice(0, 5).map((s) => s.name);
  const staffChips = [labels.staffAny, ...(staff ?? []).slice(0, 3)];

  const [treatment, setTreatment] = useState(treatments[0] ?? '');
  const [who, setWho] = useState(labels.staffAny);
  const [time, setTime] = useState('10:45');

  const summary =
    treatment && time
      ? `${treatment} · ${labels.weekdays[0]} 07/09 · ${time} · ${who}`
      : labels.summaryEmpty;

  return (
    <section id="lp-book" className="mt-4 scroll-mt-24">
      <div className="overflow-hidden rounded-[28px] border border-[color:var(--c-gold,#c6a86a)]/25 bg-white shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--c-gold,#c6a86a)]/20 bg-[color:var(--c-cream,#faf6ef)] px-6 py-5">
          <h2 className="font-display text-2xl font-black text-[color:var(--c-ink,#1b1715)]">{labels.title}</h2>
          <span className="inline-flex items-center rounded-full border border-[color:var(--c-gold,#c6a86a)]/45 bg-white px-3.5 py-1.5 text-xs font-bold text-[color:var(--c-gold-strong,#a6863f)]">
            {labels.pill}
          </span>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-3">
          {/* טיפול + צוות */}
          <div>
            <p className="mb-2 text-sm font-bold text-[color:var(--c-ink,#1b1715)]">{labels.treatmentLabel}</p>
            <div className="flex flex-wrap gap-2">
              {treatments.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTreatment(name)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    treatment === name
                      ? 'border-transparent bg-[color:var(--c-ink,#1b1715)] text-white'
                      : 'border-[color:var(--c-gold,#c6a86a)]/40 text-[color:var(--c-ink,#1b1715)]/75 hover:border-[color:var(--c-gold,#c6a86a)]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-5 text-sm font-bold text-[color:var(--c-ink,#1b1715)]">{labels.staffLabel}</p>
            <div className="flex flex-wrap gap-2">
              {staffChips.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWho(name)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    who === name
                      ? 'border-transparent bg-[color:var(--c-ink,#1b1715)] text-white'
                      : 'border-[color:var(--c-gold,#c6a86a)]/40 text-[color:var(--c-ink,#1b1715)]/75 hover:border-[color:var(--c-gold,#c6a86a)]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* תאריך — לוח מיני דקורטיבי */}
          <div>
            <p className="mb-2 text-sm font-bold text-[color:var(--c-ink,#1b1715)]">{labels.dateLabel}</p>
            <div className="rounded-2xl border border-[color:var(--c-gold,#c6a86a)]/25 bg-[color:var(--c-cream,#faf6ef)] p-3">
              <div className="grid grid-cols-7 gap-1 text-center">
                {labels.weekdays.map((d) => (
                  <span key={d} className="py-1 text-[11px] font-bold text-[color:var(--c-ink,#1b1715)]/50">
                    {d}
                  </span>
                ))}
                {CAL_DAYS.map((d, i) => (
                  <span
                    key={`${d.n}-${i}`}
                    className={`flex h-8 items-center justify-center rounded-lg text-sm ${
                      d.active
                        ? 'bg-[color:var(--c-ink,#1b1715)] font-bold text-white'
                        : d.muted
                          ? 'text-[color:var(--c-ink,#1b1715)]/30'
                          : 'text-[color:var(--c-ink,#1b1715)]/80'
                    }`}
                  >
                    {d.n}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* שעה */}
          <div>
            <p className="mb-2 text-sm font-bold text-[color:var(--c-ink,#1b1715)]">{labels.timeLabel}</p>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  dir="ltr"
                  onClick={() => setTime(slot)}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold tabular-nums transition ${
                    time === slot
                      ? 'border-transparent bg-[color:var(--c-gold,#c6a86a)] text-[color:var(--c-ink,#1b1715)]'
                      : 'border-[color:var(--c-gold,#c6a86a)]/40 text-[color:var(--c-ink,#1b1715)]/75 hover:border-[color:var(--c-gold,#c6a86a)]'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--c-gold,#c6a86a)]/20 bg-[color:var(--c-cream,#faf6ef)] px-6 py-5">
          <p className="text-sm text-[color:var(--c-ink,#1b1715)]/75">{summary}</p>
          <Link
            href={bookHref}
            className="group inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white shadow-elevated transition hover:-translate-y-0.5"
            style={{ backgroundImage: 'linear-gradient(to left, #c08f86, #a06c63)' }}
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
