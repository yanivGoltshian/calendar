'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import { detectInstallEnv, type InstallEnv } from '@/lib/pwa/detectInstallEnv';

/**
 * כרטיס התקנת אפליקציה (PWA) עצמאי, ממותג לפי הקשר:
 * variant='platform' — מיתוג תור צ׳יק לעמוד הבית של הפלטפורמה.
 * variant='business' — לוגו, שם וצבע של עסק ספציפי לעמוד ההזמנות שלו.
 *
 * לוכד beforeinstallprompt להתקנה בהקשה אחת (אנדרואיד/דסקטופ כרום). בשאר הסביבות
 * מזהה את הפלטפורמה והדפדפן דרך detectInstallEnv ומציג הנחיה מדויקת: הוספה למסך
 * הבית ב-iOS Safari, פתיחה בדפדפן חיצוני מתוך דפדפן מובנה (וואטסאפ/אינסטגרם/פייסבוק),
 * או הנחיית תפריט באנדרואיד. מסתתר לגמרי כשהאפליקציה כבר מותקנת (מצב standalone).
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
};

/** תוכן ההנחיה שנגזר מזיהוי הפלטפורמה והדפדפן. */
type HelpContent = { title: string; steps?: readonly string[]; hint?: string };

/**
 * בוחר את הנחיית ההתקנה הנכונה לפי הסביבה שזוהתה:
 * דפדפן מובנה מפנה לפתיחה בדפדפן, iOS Safari מקבל שלבי הוספה למסך הבית,
 * אנדרואיד מקבל הנחיית תפריט, וברירת המחדל היא הנחיית הדפדפן הידנית.
 */
function helpContentFor(env: InstallEnv | null): HelpContent {
  if (env?.mustOpenInBrowser) {
    return {
      title: t.install.inAppTitle,
      hint: env.platform === 'android' ? t.install.inAppHintAndroid : t.install.inAppHintIos,
    };
  }
  if (env?.canAddToHomeScreen) {
    return {
      title: t.install.iosTitle,
      steps: [t.install.iosStep1, t.install.iosStep2, t.install.iosStep3],
    };
  }
  if (env?.platform === 'android') {
    return { title: t.install.androidTitle, hint: t.install.androidHint };
  }
  return { title: t.install.manualTitle, hint: t.install.manualHint };
}

/** גוף ההנחיה המשותף לשני המשטחים (כהה/בהיר), נבדל רק בצבע הכותרת. */
function InstallHelp({ content, tone }: { content: HelpContent; tone: 'dark' | 'light' }) {
  const titleClass = tone === 'dark' ? 'text-[#E8ECF3]' : 'text-slate-800';
  return (
    <>
      <p className={`mb-1 font-semibold ${titleClass}`}>{content.title}</p>
      {content.steps ? (
        <ol className="list-inside list-decimal space-y-1">
          {content.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{content.hint}</p>
      )}
    </>
  );
}

export default function InstallApp({
  variant,
  appName,
  logoUrl,
  brandColor,
  compact = false,
  label,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

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
  const help = helpContentFor(env);

  async function handleInstall() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      return;
    }
    setShowHelp((v) => !v);
  }

  if (compact) {
    return (
      <div dir="rtl" className="w-full">
        <button
          type="button"
          onClick={handleInstall}
          aria-expanded={showHelp}
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

        {showHelp ? (
          <div className="mt-2 rounded-lg border border-[#233047] bg-[#0B1526] p-3 text-xs leading-relaxed text-[#9AA7BD]">
            <InstallHelp content={help} tone="dark" />
          </div>
        ) : null}
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
            <img
              src={emblem}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
            />
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
          onClick={handleInstall}
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
          style={{ background: accent, color: onAccent }}
        >
          {t.install.button}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          {t.install.helpToggle}
        </button>
      </div>

      {showHelp ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <InstallHelp content={help} tone="light" />
        </div>
      ) : null}
    </div>
  );
}
