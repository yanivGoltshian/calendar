'use client';

import { useRef, useState } from 'react';

export type BeforeAfterItem = { beforeUrl: string; afterUrl: string; label?: string };

type Props = {
  title: string;
  items: BeforeAfterItem[];
  beforeLabel: string;
  afterLabel: string;
  hint: string;
};

function Slider({ item, beforeLabel, afterLabel }: { item: BeforeAfterItem; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function update(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, raw)));
  }

  return (
    <div
      ref={ref}
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] shadow-sm"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) update(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* תמונת ה"אחרי" כבסיס */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.afterUrl} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* תמונת ה"לפני" חתוכה לפי המיקום (RTL: חושפים מימין) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.beforeUrl} alt={beforeLabel} className="h-full w-full object-cover" draggable={false} />
      </div>

      <span className="pointer-events-none absolute end-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
        {afterLabel}
      </span>

      {/* ידית הגרירה */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
        <div className="h-full w-1 bg-white/90 shadow" />
        <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--biz)] text-[color:var(--biz-ink)] shadow-md">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6 3 12l6 6M15 6l6 6-6 6" />
          </svg>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        className="absolute inset-x-0 bottom-0 h-8 w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

// מקטע לפני/אחרי — מחוון הזזה אינטראקטיבי לחשיפת התוצאה.
export default function LandingBeforeAfter({ title, items, beforeLabel, afterLabel, hint }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-1 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mb-5 text-sm text-slate-500">{hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <figure key={i}>
            <Slider item={item} beforeLabel={beforeLabel} afterLabel={afterLabel} />
            {item.label ? (
              <figcaption className="mt-2 text-center text-sm font-medium text-slate-600">{item.label}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
