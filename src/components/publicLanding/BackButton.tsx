'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n';

/**
 * כפתור "חזרה" לעמוד הציבורי של העסק.
 * חוזר לעמוד הקודם בהיסטוריה, ואם אין היסטוריה (כניסה ישירה לקישור)
 * נופל חזרה לעמוד הבית של תור צ׳יק.
 *
 * כשהעמוד רץ כאפליקציה מותקנת (standalone) הכפתור מוסתר לגמרי: אין
 * לאן "לחזור" בתוך אפליקציית העסק, וכפתור שמוביל לתור צ׳יק רק מבלבל את
 * בעל העסק. הכפתור מוצג רק למבקר אמיתי שהגיע מחלון הראווה בדפדפן רגיל.
 * הזיהוי זהה לזה שב-InstallApp: display-mode: standalone (או navigator.standalone
 * ב-iOS Safari הישן).
 */
export default function BackButton() {
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    setStandalone(isStandalone);
  }, []);

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  // באפליקציה מותקנת אין להציג את הכפתור כלל (מונע דליפה לעמוד עסק מותקן).
  if (standalone) return null;

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t.publicPage.backAria}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-900"
    >
      {/* חץ המצביע ימינה — כיוון ה"חזרה" הטבעי בממשק ימין־לשמאל */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-4 w-4"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      {t.publicPage.back}
    </button>
  );
}
