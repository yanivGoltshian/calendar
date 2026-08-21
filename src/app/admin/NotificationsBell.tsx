'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import type { AdminNotification } from './notifications';

type Placement = 'mobile' | 'desktop';

const PANEL_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

/**
 * פעמון התראות מרכזי לאזור הניהול: תורים הממתינים לאישור וחידוש מנוי.
 * הפופאובר ממוקם ב-fixed לפי מיקום הכפתור ונצמד לגבולות המסך, כדי שלא ייחתך
 * על ידי הסרגל ולא יזלוג אל מחוץ לעמוד.
 */
export default function NotificationsBell({
  notifications,
  placement,
}: {
  notifications: AdminNotification[];
  placement: Placement;
}) {
  const n = t.admin.notifications;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = notifications.length;

  const reposition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(PANEL_MAX_WIDTH, vw - VIEWPORT_MARGIN * 2);
    // יישור קצה הפופאובר לקצה הכפתור, עם הצמדה לגבולות המסך.
    let left = rect.right - width;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));
    const top = rect.bottom + VIEWPORT_MARGIN;
    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, reposition]);

  const buttonRing =
    placement === 'mobile'
      ? 'h-11 w-11 border border-[#233047]'
      : 'h-10 w-10 border border-transparent';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? n.countAria.replace('{count}', String(count)) : n.bellAria}
        className={[
          'relative inline-flex items-center justify-center rounded-lg text-[#F2D695] transition hover:bg-[#16233A]',
          buttonRing,
        ].join(' ')}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-amber-400 px-1 py-0.5 text-[0.65rem] font-bold leading-none text-[#0A182D]"
          >
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={n.close}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 h-full w-full cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-label={n.title}
            dir="rtl"
            className="fixed z-50 overflow-hidden rounded-xl border border-[#233047] bg-[#0B1524] text-right shadow-2xl"
            style={
              pos
                ? { top: pos.top, left: pos.left, width: pos.width }
                : { top: -9999, left: -9999, width: PANEL_MAX_WIDTH }
            }
          >
            <div className="border-b border-[#16233A] px-4 py-3">
              <p className="text-sm font-bold text-[#F2D695]">{n.title}</p>
            </div>
            {count === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9AA7BD]">{n.empty}</p>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-[#16233A] overflow-y-auto">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 px-4 py-3 text-sm text-[#E8ECF3] transition hover:bg-[#16233A]"
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full',
                          item.kind === 'approval' ? 'bg-amber-400' : 'bg-[#C59D5F]',
                        ].join(' ')}
                      />
                      <span className="leading-snug">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
