'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import ShareHero from './ShareHero';
import { CheckIcon, PlusIcon, CloseIcon, PremiumStarIcon } from './icons';

/** צעד יחיד ברצועת הכלים (מגירת ההקמה). */
export type ToolStep = {
  title: string;
  sub: string;
  done: boolean;
  href: string;
};

export type ShareData = {
  urlDisplay: string;
  bookingLink: string;
  bookingPagePath: string;
  qrSvg: string;
  shareText: string;
  copiedLabel: string;
  copyFailedLabel: string;
};

export type HomeShellProps = {
  isLive: boolean;
  share: ShareData;
  todayCount: number;
  pendingCount: number;
  revenueDisplay: string;
  pendingHref: string;
  revenueHref: string;
  allComplete: boolean;
  percent: number;
  continueHref: string;
  setupTitle: string;
  setupSubtitle: string;
  premiumHref: string;
  steps: ToolStep[];
  calendar: ReactNode;
};

type SheetKind = 'none' | 'tools';

export default function HomeShell({
  isLive,
  share,
  todayCount,
  pendingCount,
  revenueDisplay,
  pendingHref,
  revenueHref,
  allComplete,
  percent,
  continueHref,
  setupTitle,
  setupSubtitle,
  premiumHref,
  steps,
  calendar,
}: HomeShellProps) {
  const [sheet, setSheet] = useState<SheetKind>('none');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // סגירת מגירת הכלים ב-Escape ונעילת גלילת הרקע כשהיא פתוחה.
  useEffect(() => {
    if (sheet === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheet('none');
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const openTools = () => setSheet('tools');
  const closeSheet = () => setSheet('none');

  return (
    <>
      <div className="app-wrap">
        <div className="app">
          {/* כרטיס השיתוף הראשי */}
          <ShareHero
            isLive={isLive}
            urlDisplay={share.urlDisplay}
            bookingLink={share.bookingLink}
            bookingPagePath={share.bookingPagePath}
            qrSvg={share.qrSvg}
            shareText={share.shareText}
            copiedLabel={share.copiedLabel}
            copyFailedLabel={share.copyFailedLabel}
            onToast={showToast}
          />

          {/* נתוני היום */}
          <div className="stats">
            <a className="stat" href="#tcah-calendar">
              <b>{todayCount}</b>
              <span>תורים היום</span>
            </a>
            <Link className="stat warn" href={pendingHref}>
              <b>{pendingCount}</b>
              <span>ממתינים לאישור</span>
            </Link>
            <Link className="stat" href={revenueHref}>
              <b>{revenueDisplay}</b>
              <span>הכנסה חודשית מצטברת</span>
            </Link>
          </div>

          {/* גלולת עריכה (הכול הושלם) פותחת את מגירת הכלים · רצועת ההקמה (לא הושלם)
              מנווטת ישירות לאשף האונבורדינג בצעד החסר הראשון (באגים 9/10). */}
          {allComplete ? (
            <button type="button" className="setup-pill" onClick={openTools}>
              <span className="ck">
                <CheckIcon className="ic" />
              </span>
              <span className="t">כל הכלים שלכם נמצאים כאן</span>
              <span className="re">לעריכה ›</span>
            </button>
          ) : (
            <Link className="setup-strip" href={continueHref}>
              <span className="ring" style={{ '--p': percent } as CSSProperties}>
                <i>{percent}%</i>
              </span>
              <span className="body">
                <span className="t">{setupTitle}</span>
                <span className="s">{setupSubtitle}</span>
              </span>
              <span className="go">המשך ›</span>
            </Link>
          )}

          {/* כרטיס היומן — הרכיב האמיתי הקיים */}
          <section className="cal-shell" id="tcah-calendar">
            {calendar}
          </section>
        </div>
      </div>

      {/* מגירת ההקמה */}
      <div
        className={`sheet-scrim${sheet === 'tools' ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
      >
        <div className="sheet" role="dialog" aria-modal="true" aria-label="השלמת הקמת העסק">
          <div className="grab" />
          <div className="sheet-head">
            <div className="titles">
              <h3>הכלים והשלמת ההקמה</h3>
              <p className="lead">כל מה שצריך כדי להפיק את המרב מהעסק. נפתח מכאן בכל רגע.</p>
            </div>
            <button type="button" className="x" onClick={closeSheet} aria-label="סגירה">
              <CloseIcon className="ic" />
            </button>
          </div>

          <Link className="step premium" href={premiumHref} onClick={closeSheet}>
            <span className="mk">
              <PremiumStarIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">עמוד הפרימיום שלך</span>
              <span className="s">עריכת תמונות, טקסטים וצבעים</span>
            </span>
            <span className="act">עריכה ›</span>
          </Link>

          {steps.map((step) => (
            <Link key={step.title} className="step" href={step.href} onClick={closeSheet}>
              <span className={`mk ${step.done ? 'ok' : 'no'}`}>
                {step.done ? <CheckIcon className="ic" /> : <PlusIcon className="ic" />}
              </span>
              <span className="tx">
                <span className="t">{step.title}</span>
                <span className="s">{step.sub}</span>
              </span>
              <span className={`act ${step.done ? 'done' : 'go'}`}>
                {step.done ? 'הושלם' : 'להשלמה ›'}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* טוסט חיווי */}
      <div className={`tcah-toast${toast ? ' show' : ''}`} aria-live="polite">
        <div className="bubble">{toast}</div>
      </div>
    </>
  );
}
