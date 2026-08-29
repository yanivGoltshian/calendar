import Link from 'next/link';
import { t } from '@/i18n';

/**
 * באנר התחזות קבוע וברור באזור הניהול.
 * מוצג רק כשמנהל-על פועל "כבעל העסק" של עסק אחר (עוגיית tc_imp תקפה),
 * כדי שלא יתבלבל עם חיבור אמיתי של בעל העסק. כולל קישור יציאה מהתחזות.
 */
export default function ImpersonationBanner({ businessName }: { businessName: string }) {
  const c = t.billing.superadmin.impersonation;

  return (
    <div
      dir="rtl"
      role="status"
      className="sticky top-0 z-40 flex flex-nowrap items-center justify-center gap-x-2 border-b px-3 py-1.5 text-center text-sm"
      style={{
        backgroundColor: '#0B1526',
        borderColor: '#C59D5F',
        color: '#F2D695',
        paddingTop: 'max(0.375rem, env(safe-area-inset-top))',
      }}
    >
      <span className="min-w-0 truncate whitespace-nowrap font-semibold">
        {c.bannerPrefix}
        <span style={{ color: '#FFFFFF' }}>«{businessName}»</span>
      </span>
      <span aria-hidden className="shrink-0" style={{ color: '#C59D5F' }}>
        ·
      </span>
      <Link
        href="/admin/onboarding?edit=premium"
        prefetch={false}
        className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold"
        style={{ backgroundColor: '#C59D5F', color: '#0B1526' }}
      >
        ✨ {t.admin.onboarding.premiumEditorCta.cta}
      </Link>
      <Link
        href="/admin/impersonate/stop"
        prefetch={false}
        className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold underline-offset-2 hover:underline"
        style={{ color: '#F2D695' }}
      >
        {c.exit}
      </Link>
    </div>
  );
}
