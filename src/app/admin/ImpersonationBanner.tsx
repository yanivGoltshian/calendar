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
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm"
      style={{
        backgroundColor: '#0B1526',
        borderColor: '#C59D5F',
        color: '#F2D695',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      }}
    >
      <span className="font-semibold">
        {c.bannerPrefix}
        <span style={{ color: '#FFFFFF' }}>«{businessName}»</span>
      </span>
      <span aria-hidden style={{ color: '#C59D5F' }}>
        ·
      </span>
      <Link
        href="/admin/onboarding?edit=premium"
        prefetch={false}
        className="min-h-[44px] rounded-lg px-3 py-1 font-bold"
        style={{ backgroundColor: '#C59D5F', color: '#0B1526' }}
      >
        ✨ {t.admin.onboarding.premiumEditorCta.cta}
      </Link>
      <span aria-hidden style={{ color: '#C59D5F' }}>
        ·
      </span>
      <Link
        href="/admin/impersonate/stop"
        prefetch={false}
        className="min-h-[44px] rounded-lg px-3 py-1 font-bold underline-offset-2 hover:underline"
        style={{ color: '#F2D695' }}
      >
        {c.exit}
      </Link>
    </div>
  );
}
