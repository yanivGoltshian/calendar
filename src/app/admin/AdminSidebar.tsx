'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Mascot } from '@/components/brand/Mascot';
import InstallApp from '@/components/pwa/InstallApp';
import { ownerLogout } from './actions';
import NotificationsBell from './NotificationsBell';
import type { AdminNotification } from './notifications';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: t.admin.nav.calendar, exact: true },
  { href: '/admin/appointments', label: t.admin.nav.appointments },
  { href: '/admin/services', label: t.admin.nav.services },
  { href: '/admin/team', label: t.admin.nav.team },
  { href: '/admin/working-hours', label: t.admin.nav.workingHours },
  { href: '/admin/clients', label: t.admin.nav.clients },
  { href: '/admin/pos', label: t.admin.nav.pos },
  { href: '/admin/inventory', label: t.admin.nav.inventory },
  { href: '/admin/documents', label: t.admin.nav.documents },
  { href: '/admin/marketing', label: t.admin.nav.marketing },
  { href: '/admin/stats', label: t.admin.nav.stats },
  { href: '/admin/punch-cards', label: t.admin.nav.punchCards },
  { href: '/admin/waitlist', label: t.admin.nav.waitlist },
  { href: '/admin/onboarding', label: t.admin.nav.onboarding },
  { href: '/admin/upgrade', label: t.quote.nav },
  { href: '/admin/settings', label: t.admin.nav.settings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export default function AdminSidebar({
  pendingCount = 0,
  notifications = [],
}: {
  pendingCount?: number;
  notifications?: AdminNotification[];
}) {
  const pathname = usePathname() ?? '/admin';
  const isHome = pathname === '/admin';
  const [open, setOpen] = useState(false);

  // סגירת המגירה בכל מעבר עמוד.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // כשהמגירה פתוחה: סגירה ב-Escape ונעילת גלילת הרקע.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const brand = (
    <Link
      href="/"
      aria-label={BRAND.name}
      className="flex items-center gap-2 rounded-lg transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2D695]"
    >
      <Mascot pose="head" size={26} className="drop-shadow-sm" />
      <p className="text-lg font-bold text-[#F2D695]">{BRAND.name}</p>
    </Link>
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label={t.admin.menuLabel}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const showBadge = item.href === '/admin/appointments' && pendingCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium transition',
              active
                ? 'bg-[#2f241d] text-[#F2D695] shadow-inner'
                : 'text-[#f3ece0] hover:bg-[#2f241d]/60 hover:text-[#F2D695]',
            ].join(' ')}
          >
            {item.label}
            {showBadge ? (
              <span
                aria-label={t.admin.pendingApprovals.badgeAria}
                className="ms-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-[#1c1512]"
              >
                {pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto flex flex-col gap-3 px-1">
      <InstallApp variant="admin" compact />
      <form action={ownerLogout}>
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-lg border border-[#82643C] px-3 py-2 text-sm font-medium text-[#F2D695] transition hover:bg-[#82643C]/20"
        >
          {t.admin.logout}
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* סרגל עליון קומפקטי למובייל (< md) — מוסתר בלוח הבית שבו HomeShell מספק סרגל משלו */}
      {!isHome && (
      <div
        dir="rtl"
        className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[#2f241d] bg-[#1c1512] px-4 py-3 md:hidden"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {brand}
        <div className="flex items-center gap-2">
          <NotificationsBell notifications={notifications} placement="mobile" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="admin-mobile-drawer"
            aria-label={t.admin.openMenu}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#3a2c22] text-[#F2D695] transition hover:bg-[#2f241d]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* מגירת ניווט (< md) */}
      {!isHome && open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={t.admin.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/50"
          />
          <div
            id="admin-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.admin.menuLabel}
            dir="rtl"
            className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col gap-4 overflow-y-auto bg-[#1c1512] p-4 shadow-2xl"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.admin.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#3a2c22] text-[#F2D695] transition hover:bg-[#2f241d]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      ) : null}

      {/* סרגל צד קבוע (md+) — ללא שינוי מהתצוגה הקיימת */}
      <aside
        dir="rtl"
        className="relative hidden shrink-0 flex-col gap-4 bg-[#1c1512] p-4 md:flex md:sticky md:top-0 md:h-screen md:w-64 md:overflow-y-auto"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-start justify-between px-2 pt-1">
          <div>
            {brand}
            <p className="text-xs text-[#c9b79f]">{t.admin.panelTitle}</p>
          </div>
          <NotificationsBell notifications={notifications} placement="desktop" />
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
