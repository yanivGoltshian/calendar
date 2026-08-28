'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import InstallApp from '@/components/pwa/InstallApp';
import { ownerLogout } from '../actions';
import NotificationsBell from '../NotificationsBell';
import type { AdminNotification } from '../notifications';
import ShareHero from './ShareHero';
import {
  MenuIcon,
  CheckIcon,
  PlusIcon,
  CloseIcon,
  CalendarNavIcon,
  OrdersIcon,
  ClientsIcon,
  ServicesIcon,
  MoreIcon,
  PremiumStarIcon,
  TeamIcon,
  ClockIcon,
  BarsIcon,
  WaitlistIcon,
  UpgradeStarIcon,
  HelpIcon,
  InstallIcon,
  LogoutIcon,
} from './icons';

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
  logoLetter: string;
  bizName: string;
  greeting: string;
  notifications: AdminNotification[];
  isLive: boolean;
  share: ShareData;
  todayCount: number;
  pendingCount: number;
  revenueDisplay: string;
  pendingHref: string;
  revenueHref: string;
  allComplete: boolean;
  percent: number;
  setupTitle: string;
  setupSubtitle: string;
  premiumHref: string;
  steps: ToolStep[];
  helpHref: string;
  calendar: ReactNode;
};

type SheetKind = 'none' | 'more' | 'tools';

export default function HomeShell({
  logoLetter,
  bizName,
  greeting,
  notifications,
  isLive,
  share,
  todayCount,
  pendingCount,
  revenueDisplay,
  pendingHref,
  revenueHref,
  allComplete,
  percent,
  setupTitle,
  setupSubtitle,
  premiumHref,
  steps,
  helpHref,
  calendar,
}: HomeShellProps) {
  const [sheet, setSheet] = useState<SheetKind>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [bellOpenSignal, setBellOpenSignal] = useState(0);
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

  // סגירת מגירות ב-Escape ונעילת גלילת הרקע כשמגירה פתוחה.
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

  const openBellFromMore = () => {
    setSheet('none');
    setBellOpenSignal((n) => n + 1);
  };

  return (
    <>
      <div className="app-wrap">
        <div className="app">
          {/* סרגל עליון */}
          <div className="topbar">
            <div className="biz">
              <div className="logo">{logoLetter}</div>
              <div className="who">
                <div className="n">{bizName}</div>
                <div className="r">{greeting}</div>
              </div>
            </div>
            <div className="tools">
              <NotificationsBell
                notifications={notifications}
                placement="mobile"
                variant="home"
                openSignal={bellOpenSignal}
              />
              <button
                type="button"
                className="icobtn"
                aria-label="תפריט"
                aria-haspopup="dialog"
                aria-expanded={sheet === 'more'}
                onClick={() => setSheet('more')}
              >
                <MenuIcon className="ic" />
              </button>
            </div>
          </div>

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

          {/* רצועת השלמת הקמה / גלולת עריכה — פותחות תמיד את מגירת הכלים */}
          {allComplete ? (
            <button type="button" className="setup-pill" onClick={openTools}>
              <span className="ck">
                <CheckIcon className="ic" />
              </span>
              <span className="t">כל הכלים שלכם נמצאים כאן</span>
              <span className="re">לעריכה ›</span>
            </button>
          ) : (
            <button type="button" className="setup-strip" onClick={openTools}>
              <span className="ring" style={{ '--p': percent } as CSSProperties}>
                <i>{percent}%</i>
              </span>
              <span className="body">
                <span className="t">{setupTitle}</span>
                <span className="s">{setupSubtitle}</span>
              </span>
              <span className="go">המשך ›</span>
            </button>
          )}

          {/* כרטיס היומן — הרכיב האמיתי הקיים */}
          <section className="cal-shell" id="tcah-calendar">
            {calendar}
          </section>
        </div>
      </div>

      {/* ניווט תחתון */}
      <nav className="botnav">
        <div className="bar">
          <Link className="on" href="/admin">
            <span className="i">
              <CalendarNavIcon className="ic" />
            </span>
            יומן
          </Link>
          <Link href="/admin/appointments">
            <span className="i">
              <OrdersIcon className="ic" />
            </span>
            הזמנות
          </Link>
          <Link href="/admin/clients">
            <span className="i">
              <ClientsIcon className="ic" />
            </span>
            לקוחות
          </Link>
          <Link href="/admin/services">
            <span className="i">
              <ServicesIcon className="ic" />
            </span>
            שירותים
          </Link>
          <button type="button" onClick={() => setSheet('more')}>
            <span className="i">
              <MoreIcon className="ic" />
            </span>
            עוד
          </button>
        </div>
      </nav>

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
              <span className="s">עוצב והושלם · עריכת תמונות, טקסטים וצבעים</span>
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

      {/* מגירת "עוד" */}
      <div
        className={`sheet-scrim${sheet === 'more' ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
      >
        <div className="sheet" role="dialog" aria-modal="true" aria-label="עוד">
          <div className="grab" />
          <div className="sheet-head">
            <div className="titles">
              <h3>עוד</h3>
              <p className="lead">כל הכלים והמסכים לניהול היומיומי של העסק.</p>
            </div>
            <button type="button" className="x" onClick={closeSheet} aria-label="סגירה">
              <CloseIcon className="ic" />
            </button>
          </div>

          <Link className="more-row" href="/admin/team" onClick={closeSheet}>
            <span className="mi">
              <TeamIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">צוות</span>
              <span className="s">ניהול אנשי הצוות</span>
            </span>
            <span className="ch">›</span>
          </Link>
          <Link className="more-row" href="/admin/working-hours" onClick={closeSheet}>
            <span className="mi">
              <ClockIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">שעות עבודה</span>
              <span className="s">ימי וזמני הפעילות</span>
            </span>
            <span className="ch">›</span>
          </Link>
          <Link className="more-row" href="/admin/stats" onClick={closeSheet}>
            <span className="mi">
              <BarsIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">סטטיסטיקות</span>
              <span className="s">הכנסות ופילוח שירותים</span>
            </span>
            <span className="ch">›</span>
          </Link>
          <Link className="more-row" href="/admin/waitlist" onClick={closeSheet}>
            <span className="mi">
              <WaitlistIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">רשימת המתנה</span>
              <span className="s">לקוחות בהמתנה לתור</span>
            </span>
            <span className="ch">›</span>
          </Link>
          <button type="button" className="more-row" onClick={openBellFromMore}>
            <span className="mi">
              <NotificationsBellRowIcon />
            </span>
            <span className="tx">
              <span className="t">תזכורות והודעות</span>
              <span className="s">אישורים ותזכורות מהפעמון</span>
            </span>
            <span className="ch">›</span>
          </button>
          <Link className="more-row" href="/admin/upgrade" onClick={closeSheet}>
            <span className="mi">
              <UpgradeStarIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">שדרוג והצעת מחיר</span>
              <span className="s">חבילת הפרימיום שלכם</span>
            </span>
            <span className="ch">›</span>
          </Link>
          <a className="more-row" href={helpHref}>
            <span className="mi">
              <HelpIcon className="ic" />
            </span>
            <span className="tx">
              <span className="t">עזרה ותמיכה</span>
              <span className="s">יצירת קשר עם הצוות שלנו</span>
            </span>
            <span className="ch">›</span>
          </a>
          <InstallApp
            variant="admin"
            compact
            triggerClassName="more-row"
            triggerChildren={
              <>
                <span className="mi">
                  <InstallIcon className="ic" />
                </span>
                <span className="tx">
                  <span className="t">התקנת האפליקציה</span>
                  <span className="s">הוספה למסך הבית</span>
                </span>
                <span className="ch">›</span>
              </>
            }
          />
          <form action={ownerLogout}>
            <button type="submit" className="more-row danger">
              <span className="mi">
                <LogoutIcon className="ic" />
              </span>
              <span className="tx">
                <span className="t">התנתקות</span>
                <span className="s">יציאה מהחשבון</span>
              </span>
              <span className="ch">›</span>
            </button>
          </form>
        </div>
      </div>

      {/* טוסט חיווי */}
      <div className={`tcah-toast${toast ? ' show' : ''}`} aria-live="polite">
        <div className="bubble">{toast}</div>
      </div>
    </>
  );
}

/** אייקון הפעמון לשורת "תזכורות והודעות" (זהה לפעמון בסרגל העליון). */
function NotificationsBellRowIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
