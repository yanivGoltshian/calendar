'use client';

import { useRouter } from 'next/navigation';
import { t } from '@/i18n';

/**
 * כפתור "חזרה" עצמאי (RTL). מנווט לעמוד הקודם בהיסטוריה, ואם אין היסטוריה
 * פנימית חוזר לדף הבית. ניתן למקם בכל עמוד (כולל עמודי עסק) בלי תלות בעמוד עצמו.
 *
 * שימוש: <BackButton /> או <BackButton fallbackHref="/" />
 */
export default function BackButton({
  className = '',
  fallbackHref = '/',
}: {
  className?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t.publicPage.backAria}
      className={`inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white/90 px-4 py-2 text-sm font-medium text-sand-700 shadow-sm backdrop-blur transition-colors hover:bg-sand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-sand-700 dark:bg-sand-900/90 dark:text-sand-200 dark:hover:bg-sand-800 ${className}`}
    >
      {/* בחזרה ב-RTL החץ מצביע ימינה */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{t.publicPage.back}</span>
    </button>
  );
}
