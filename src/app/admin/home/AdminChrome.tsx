'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InstallApp from '@/components/pwa/InstallApp';
import { ownerLogout } from '../actions';
import NotificationsBell from '../NotificationsBell';
import type { AdminNotification } from '../notifications';
import {
  ADMIN_BOTTOM_NAV,
  ADMIN_MORE_ROWS,
  isAdminNavActive,
  type AdminNavItem,
} from '../adminNav';
import {
  MenuIcon,
  CloseIcon,
  CalendarNavIcon,
  OrdersIcon,
  ClientsIcon,
  ServicesIcon,
  MoreIcon,
  TeamIcon,
  ClockIcon,
  BarsIcon,
  WaitlistIcon,
  UpgradeStarIcon,
  HelpIcon,
  InstallIcon,
  LogoutIcon,
} from './icons';
import './home.css';

type AdminChromeProps = {
  logoLetter: string;
  bizName: string;
  greeting: string;
  notifications: AdminNotification[];
  children: ReactNode;
};

/** אייקון הפעמון לשורת "תזכורות והודעות" (זהה לפעמון בסרגל העליון). */
function BellRowIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** אייקון לשורת ניווט תחתון לפי מזהה הפריט. */
function bottomIcon(id: string) {
  switch (id) {
    case 'home':
      return <CalendarNavIcon className="ic" />;
    case 'appointments':
      return <OrdersIcon className="ic" />;
    case 'clients':
      return <ClientsIcon className="ic" />;
    case 'services':
      return <ServicesIcon className="ic" />;
    default:
      return <MoreIcon className="ic" />;
  }
}

/** אייקון לשורת גיליון "עוד" לפי מזהה הפריט. */
function moreIcon(id: string) {
  switch (id) {
    case 'team':
      return <TeamIcon className="ic" />;
    case 'working-hours':
      return <ClockIcon className="ic" />;
    case 'stats':
      return <BarsIcon className="ic" />;
    case 'waitlist':
      return <WaitlistIcon className="ic" />;
    case 'notifications':
      return <BellRowIcon />;
    case 'upgrade':
      return <UpgradeStarIcon className="ic" />;
    case 'help':
      return <HelpIcon className="ic" />;
    case 'install':
      return <InstallIcon className="ic" />;
    case 'logout':
      return <LogoutIcon className="ic" />;
    default:
      return <MoreIcon className="ic" />;
  }
}

/**
 * מעטפת אזור הניהול המשותפת: סרגל עליון + אזור תוכן + ניווט תחתון + גיליון "עוד".
 * מוחלת על כל עמודי /admin דרך layout, כדי שהכותרת והתפריט יהיו זהים בין הבית
 * לעמודים הפנימיים, ומקור אמת יחיד לניווט (adminNav) מונע חזרה של נתיבים שהוסרו.
 */
export default function AdminChrome({
  logoLetter,
  bizName,
  greeting,
  notifications,
  children,
}: AdminChromeProps) {
  const pathname = usePathname() ?? '/admin';
  const [moreOpen, setMoreOpen] = useState(false);
  const [bellOpenSignal, setBellOpenSignal] = useState(0);

  // סגירת הגיליון ב-Escape ונעילת גלילת הרקע כשהוא פתוח.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const closeSheet = () => setMoreOpen(false);
  const openBellFromMore = () => {
    setMoreOpen(false);
    setBellOpenSignal((n) => n + 1);
  };

  const rowInner = (item: AdminNavItem) => (
    <>
      <span className="mi">{moreIcon(item.id)}</span>
      <span className="tx">
        <span className="t">{item.label}</span>
        {item.sub ? <span className="s">{item.sub}</span> : null}
      </span>
      <span className="ch">›</span>
    </>
  );

  return (
    <div className="tcah admin-shell" dir="rtl">
      {/* סרגל עליון משותף */}
      <div className="topwrap">
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
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <MenuIcon className="ic" />
            </button>
          </div>
        </div>
      </div>

      {/* אזור התוכן של העמוד */}
      <div className="admin-main">{children}</div>

      {/* ניווט תחתון משותף */}
      <nav className="botnav">
        <div className="bar">
          {ADMIN_BOTTOM_NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href as string}
              className={isAdminNavActive(item.href as string, pathname) ? 'on' : undefined}
            >
              <span className="i">{bottomIcon(item.id)}</span>
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)}>
            <span className="i">
              <MoreIcon className="ic" />
            </span>
            עוד
          </button>
        </div>
      </nav>

      {/* גיליון "עוד" — 13 פריטי ה-whitelist בלבד */}
      <div
        className={`sheet-scrim${moreOpen ? ' open' : ''}`}
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

          {ADMIN_MORE_ROWS.map((item) => {
            if (item.action === 'link') {
              return (
                <Link key={item.id} className="more-row" href={item.href as string} onClick={closeSheet}>
                  {rowInner(item)}
                </Link>
              );
            }
            if (item.action === 'bell') {
              return (
                <button key={item.id} type="button" className="more-row" onClick={openBellFromMore}>
                  {rowInner(item)}
                </button>
              );
            }
            if (item.action === 'install') {
              return (
                <InstallApp
                  key={item.id}
                  variant="admin"
                  compact
                  persistTrigger
                  triggerClassName="more-row"
                  triggerChildren={rowInner(item)}
                />
              );
            }
            // logout
            return (
              <form key={item.id} action={ownerLogout}>
                <button type="submit" className="more-row danger">
                  {rowInner(item)}
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
