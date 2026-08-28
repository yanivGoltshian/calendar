'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import {
  detectInstallEnv,
  installGuideFor,
  type InstallEnv,
  type InstallGuide,
} from '@/lib/pwa/detectInstallEnv';

/**
 * כרטיס התקנת אפליקציה (PWA) עצמאי, ממותג לפי הקשר:
 * variant='platform' — מיתוג תור צ׳יק לעמוד הבית של הפלטפורמה.
 * variant='business' — לוגו, שם וצבע של עסק ספציפי לעמוד ההזמנות שלו.
 * variant='admin' / 'superadmin' — כפתור קומפקטי לסרגלי הניהול.
 *
 * לוכד beforeinstallprompt כדי לאפשר התקנה בהקשה אחת (אנדרואיד/דסקטופ כרום/אדג׳):
 * הקשה על הכפתור מפעילה מיד את חלון ההתקנה של הדפדפן. כשההתקנה בהקשה אחת אינה
 * זמינה (iOS Safari, דפדפן מובנה, דפדפן מחשב אחר) נפתח חלון הנחיה מודרך עם איור
 * וצעדים מדויקים לפי הפלטפורמה — כולל כפתור העתקת קישור לפתיחה בדפדפן אמיתי.
 * מסתתר לגמרי כשהאפליקציה כבר מותקנת (מצב standalone).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Variant = 'platform' | 'business' | 'admin' | 'superadmin';

type Props = {
  variant: Variant;
  appName?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  /** מצב קומפקטי: כפתור בודד המתאים למשטחים כהים (סרגל הניהול / כותרת הפלטפורמה). */
  compact?: boolean;
  /** תווית חלופית לכפתור (ברירת המחדל: t.install.button). */
  label?: string;
  /** מחלקת CSS חלופית לכפתור ההפעלה במצב קומפקטי (למשל שורת "עוד" בלוח הבית). */
  triggerClassName?: string;
  /** תוכן חלופי לכפתור ההפעלה במצב קומפקטי. גובר על העיצוב הכהה המובנה. */
  triggerChildren?: ReactNode;
};

type GlyphName = 'share' | 'menu' | 'desktop' | 'browser';

/** תוכן חלון ההנחיה, נגזר מהפלטפורמה והדפדפן שזוהו. */
type SheetContent = {
  title: string;
  intro: string;
  steps: readonly string[];
  hint?: string;
  /** האם להציג כפתור "העתקת הקישור" והקישור עצמו (דפדפן מובנה / iOS ללא ספארי). */
  showCopy?: boolean;
  glyph: GlyphName;
};

/**
 * בוחר את תוכן ההנחיה המדויק לפי הסביבה שזוהתה. משתמש ב-installGuideFor הטהור
 * כדי למפות סביבה → סוג הנחיה, ואז שולף את המחרוזות המתאימות מ-he.ts.
 */
function sheetContentFor(env: InstallEnv | null): SheetContent {
  const guide: InstallGuide = env ? installGuideFor(env) : 'manual';
  switch (guide) {
    case 'ios':
      return {
        title: t.install.iosTitle,
        intro: t.install.iosIntro,
        steps: [t.install.iosStep1, t.install.iosStep2, t.install.iosStep3],
        glyph: 'share',
      };
    case 'iosOtherBrowser':
      return {
        title: t.install.iosOtherTitle,
        intro: t.install.iosOtherIntro,
        steps: [t.install.iosOtherStep1, t.install.iosOtherStep2, t.install.iosOtherStep3],
        showCopy: true,
        glyph: 'browser',
      };
    case 'android':
      return {
        title: t.install.androidTitle,
        intro: t.install.androidIntro,
        steps: [t.install.androidStep1, t.install.androidStep2, t.install.androidStep3],
        glyph: 'menu',
      };
    case 'desktop':
      return {
        title: t.install.desktopTitle,
        intro: t.install.desktopIntro,
        steps: [t.install.desktopStep1, t.install.desktopStep2, t.install.desktopStep3],
        glyph: 'desktop',
      };
    case 'inApp': {
      const ios = env?.platform === 'ios';
      return {
        title: t.install.inAppTitle,
        intro: t.install.inAppIntro,
        steps: ios
          ? [t.install.inAppStep1Ios, t.install.inAppStep2Ios, t.install.inAppStep3Ios]
          : [t.install.inAppStep1Android, t.install.inAppStep2Android, t.install.inAppStep3Android],
        hint: t.install.inAppCopyHint,
        showCopy: true,
        glyph: 'browser',
      };
    }
    case 'manual':
    default:
      return {
        title: t.install.manualTitle,
        intro: t.install.manualIntro,
        steps: [t.install.manualStep1, t.install.manualStep2, t.install.manualStep3],
        glyph: 'menu',
      };
  }
}

/** איור פשוט (SVG מוטבע) הממחיש את הפעולה המרכזית של כל פלטפורמה. */
function GuideGlyph({
  glyph,
  accent,
  onAccent,
}: {
  glyph: GlyphName;
  accent: string;
  onAccent: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
      style={{ background: accent, color: onAccent }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph === 'share' ? (
          // סמל השיתוף של iOS: ריבוע עם חץ כלפי מעלה
          <>
            <path d="M12 3v11" />
            <path d="M8.5 6.5 12 3l3.5 3.5" />
            <path d="M6 12H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-1" />
          </>
        ) : glyph === 'menu' ? (
          // תפריט שלוש הנקודות (אנכי)
          <>
            <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
          </>
        ) : glyph === 'desktop' ? (
          // מסך מחשב עם חץ התקנה כלפי מטה
          <>
            <rect x="3" y="4" width="18" height="12" rx="1.5" />
            <path d="M9 20h6M12 16v4" />
            <path d="M12 7v5m0 0-2-2m2 2 2-2" />
          </>
        ) : (
          // גלובוס: פתיחה בדפדפן אמיתי
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * חלון ההנחיה המודרך (Sheet). RTL, נגיש (role=dialog, aria-modal), נסגר ב-Escape,
 * בלחיצה על הרקע או על כפתור הסגירה. קל משקל: overlay קבוע ללא תלות חיצונית.
 */
function InstallSheet({
  content,
  accent,
  onAccent,
  onClose,
}: {
  content: SheetContent;
  accent: string;
  onAccent: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const url = typeof window !== 'undefined' ? window.location.href : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      dir="rtl"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-sheet-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <GuideGlyph glyph={content.glyph} accent={accent} onAccent={onAccent} />
          <div className="min-w-0 flex-1">
            <h2 id="install-sheet-title" className="text-lg font-bold text-slate-900">
              {content.title}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{content.intro}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.install.close}
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ol className="mt-4 space-y-3">
          {content.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: `${accent}1a`, color: accent }}
              >
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-slate-700">{step}</span>
            </li>
          ))}
        </ol>

        {content.showCopy ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
              style={{ background: accent, color: onAccent }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {copied ? (
                  <path d="M20 6 9 17l-5-5" />
                ) : (
                  <>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
                  </>
                )}
              </svg>
              {copied ? t.install.copied : t.install.copyLink}
            </button>
            <p dir="ltr" className="mt-2 truncate text-center text-xs text-slate-400">
              {url}
            </p>
            {content.hint ? (
              <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
                {content.hint}
              </p>
            ) : null}
          </div>
        ) : content.hint ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{content.hint}</p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {t.install.gotIt}
        </button>
      </div>
    </div>
  );
}

export default function InstallApp({
  variant,
  appName,
  logoUrl,
  brandColor,
  compact = false,
  label,
  triggerClassName,
  triggerChildren,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone) setInstalled(true);

    setEnv(
      detectInstallEnv(nav.userAgent, {
        standalone,
        maxTouchPoints: nav.maxTouchPoints,
      }),
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setSheetOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  if (!mounted || installed) return null;

  const name = variant === 'business' ? appName ?? '' : BRAND.name;
  const accent = variant === 'business' ? resolveBrandColor(brandColor) : BRAND.themeColor;
  const onAccent = readableText(accent);
  const subtitle =
    variant === 'business'
      ? t.install.businessSubtitle
      : variant === 'admin'
        ? t.install.adminSubtitle
        : variant === 'superadmin'
          ? t.install.superadminSubtitle
          : t.install.platformSubtitle;
  const title = `${t.install.titlePrefix} ${name}`.trim();
  const initial = name.charAt(0) || BRAND.name.charAt(0);
  const emblem = variant === 'platform' ? '/brand/torchick-emblem-navy-256.png' : logoUrl || null;
  const content = sheetContentFor(env);

  /**
   * הפעולה המרכזית: אם נלכד אירוע התקנה (אנדרואיד/דסקטופ כרום/אדג׳) — מפעילים
   * מיד את חלון ההתקנה של הדפדפן (התקנה בהקשה אחת). אחרת פותחים את חלון ההנחיה.
   */
  async function handlePrimary() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      return;
    }
    setSheetOpen(true);
  }

  const sheet = sheetOpen ? (
    <InstallSheet content={content} accent={accent} onAccent={onAccent} onClose={closeSheet} />
  ) : null;

  if (compact) {
    if (triggerChildren) {
      return (
        <>
          <button
            type="button"
            className={triggerClassName}
            onClick={handlePrimary}
            aria-haspopup={deferred ? undefined : 'dialog'}
            aria-label={label ?? subtitle}
          >
            {triggerChildren}
          </button>
          {sheet}
        </>
      );
    }
    return (
      <div dir="rtl" className="w-full">
        <button
          type="button"
          onClick={handlePrimary}
          aria-haspopup={deferred ? undefined : 'dialog'}
          aria-label={label ?? subtitle}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#82643C] px-3 py-2 text-sm font-semibold text-[#F2D695] transition hover:bg-[#82643C]/20"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
          </svg>
          {label ?? t.install.button}
        </button>
        {sheet}
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      style={{ boxShadow: `0 1px 0 0 ${accent}14` }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: accent, color: onAccent }}
        >
          {emblem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblem} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
          ) : (
            <span className="text-2xl font-bold">{initial}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span
            className="mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${accent}14`, color: accent }}
          >
            {t.install.badge}
          </span>
          <h3 className="truncate text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePrimary}
          aria-haspopup={deferred ? undefined : 'dialog'}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
          style={{ background: accent, color: onAccent }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
          </svg>
          {t.install.button}
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          {t.install.helpToggle}
        </button>
      </div>

      {sheet}
    </div>
  );
}
