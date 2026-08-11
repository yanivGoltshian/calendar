'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { resolveBrandColor, readableText } from '@/lib/brandColor';

/**
 * כרטיס התקנת אפליקציה (PWA) עצמאי, ממותג לפי הקשר:
 * variant='platform' — מיתוג תור צ׳יק לעמוד הבית של הפלטפורמה.
 * variant='business' — לוגו, שם וצבע של עסק ספציפי לעמוד ההזמנות שלו.
 *
 * לוכד beforeinstallprompt להתקנה בהקשה אחת; ב-iOS Safari (שאין בו אירוע כזה)
 * מציג הנחיה עברית קצרה. מסתתר לגמרי כשהאפליקציה כבר מותקנת (מצב standalone).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Variant = 'platform' | 'business';

type Props = {
  variant: Variant;
  appName?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
};

export default function InstallApp({ variant, appName, logoUrl, brandColor }: Props) {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setMounted(true);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(iOS);

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
  const subtitle = variant === 'business' ? t.install.businessSubtitle : t.install.platformSubtitle;
  const title = `${t.install.titlePrefix} ${name}`.trim();
  const initial = name.charAt(0) || BRAND.name.charAt(0);
  const emblem = variant === 'platform' ? '/brand/torchick-emblem-navy-256.png' : logoUrl || null;

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
          {isIOS ? (
            <>
              <p className="mb-2 font-semibold text-slate-800">{t.install.iosTitle}</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>{t.install.iosStep1}</li>
                <li>{t.install.iosStep2}</li>
                <li>{t.install.iosStep3}</li>
              </ol>
            </>
          ) : (
            <>
              <p className="mb-1 font-semibold text-slate-800">{t.install.manualTitle}</p>
              <p>{t.install.manualHint}</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
