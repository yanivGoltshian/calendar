'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { logout } from '@/app/account/actions';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: t.admin.nav.calendar, exact: true },
  { href: '/admin/appointments', label: t.admin.nav.appointments },
  { href: '/admin/services', label: t.admin.nav.services },
  { href: '/admin/team', label: t.admin.nav.team },
  { href: '/admin/clients', label: t.admin.nav.clients },
  { href: '/admin/onboarding', label: t.admin.nav.onboarding },
  { href: '/admin/settings', label: t.admin.nav.settings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export default function AdminSidebar() {
  const pathname = usePathname() ?? '/admin';

  return (
    <aside
      dir="rtl"
      className="flex w-full shrink-0 flex-col gap-4 bg-[#08101C] p-4 md:h-screen md:w-64 md:sticky md:top-0"
    >
      <div className="px-2 pt-1">
        <p className="text-lg font-bold text-[#F2D695]">{BRAND.name}</p>
        <p className="text-xs text-[#9AA7BD]">{t.admin.panelTitle}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label={t.admin.panelTitle}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-[#16233A] text-[#F2D695] shadow-inner'
                  : 'text-[#E8ECF3] hover:bg-[#16233A]/60 hover:text-[#F2D695]',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={logout} className="px-1">
        <button
          type="submit"
          className="w-full rounded-lg border border-[#82643C] px-3 py-2 text-sm font-medium text-[#F2D695] transition hover:bg-[#82643C]/20"
        >
          {t.admin.logout}
        </button>
      </form>
    </aside>
  );
}
