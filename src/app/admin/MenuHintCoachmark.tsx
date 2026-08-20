'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { shouldShowMenuHint, markMenuHintSeen } from './menuHint';

/** אירוע חלון שמסנכרן סגירה בין מופע המובייל למופע הדסקטופ. */
const DISMISS_EVENT = 'torchick:menu-hint-dismissed';

type Variant = 'mobile' | 'desktop';

/**
 * רמז חד-פעמי (coach-mark) שמצביע על הפקד שמאחוריו מסתתרים כל כלי הניהול:
 * כפתור ההמבורגר במובייל, וסרגל הצד בדסקטופ. מוצג פעם אחת בלבד אי פעם,
 * נסגר בפתיחת התפריט, בלחיצה על "הבנתי" או ב-Escape, ואינו חוזר.
 *
 * הרכיב תוספתי בלבד: הוא מרונדר בתוך העוגן הקיים ואינו משנה את התנהגות המגירה.
 */
export default function MenuHintCoachmark({
  variant,
  open = false,
}: {
  variant: Variant;
  /** האם התפריט נפתח בפועל (רלוונטי למובייל) — פתיחה סוגרת את הרמז. */
  open?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dismiss = useCallback(() => {
    markMenuHintSeen(typeof window === 'undefined' ? null : window.localStorage);
    setVisible(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(DISMISS_EVENT));
    }
  }, []);

  // קריאה חד-פעמית מ-localStorage לאחר ההרכבה, כדי למנוע אי-התאמת הידרציה מול ה-SSR.
  useEffect(() => {
    if (shouldShowMenuHint(window.localStorage)) setVisible(true);
  }, []);

  // כיבוד העדפת "תנועה מופחתת" ברמת המערכת: אם מופעלת, אין פעימה — רק הבועית.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // סגירה מסונכרנת בין המופעים (מובייל ודסקטופ חולקים דגל אחד).
  useEffect(() => {
    const onDismiss = () => setVisible(false);
    window.addEventListener(DISMISS_EVENT, onDismiss);
    return () => window.removeEventListener(DISMISS_EVENT, onDismiss);
  }, []);

  // פתיחת התפריט בפועל = הרמז מיצה את תפקידו: סוגרים ומסמנים כנצפה.
  useEffect(() => {
    if (open && visible) dismiss();
  }, [open, visible, dismiss]);

  // סגירה ב-Escape כל עוד הרמז מוצג.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  const h = t.admin.menuHint;
  const titleId = `menu-hint-title-${variant}`;
  const bodyId = `menu-hint-body-${variant}`;
  const showPulse = variant === 'mobile' && !reducedMotion;

  // מיקום הבועית לפי הווריאנט: מתחת לכפתור ההמבורגר (מובייל) או בראש הסרגל (דסקטופ).
  const popoverPos =
    variant === 'mobile'
      ? 'absolute right-0 top-full mt-3 z-50'
      : 'absolute right-2 left-2 top-[4.75rem] z-40';
  const arrowPos = variant === 'mobile' ? 'right-4' : 'right-8';

  return (
    <>
      {showPulse ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-[#F2D695] animate-ping"
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        dir="rtl"
        className={`${popoverPos} w-64 max-w-[80vw] rounded-xl border border-[#82643C] bg-[#0F1D33] p-3 text-right shadow-2xl`}
      >
        {/* חץ קטן שמצביע כלפי מעלה אל הפקד */}
        <span
          aria-hidden="true"
          className={`absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-[#82643C] bg-[#0F1D33] ${arrowPos}`}
        />
        <p id={titleId} className="text-sm font-bold text-[#F2D695]">
          {h.title}
        </p>
        <p id={bodyId} className="mt-1 text-xs leading-relaxed text-[#E8ECF3]">
          {h.body}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={h.gotIt}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#F2D695] px-3 py-2 text-sm font-bold text-[#08101C] transition hover:bg-[#E4BF6F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2D695]"
        >
          {h.gotIt}
        </button>
      </div>
    </>
  );
}
