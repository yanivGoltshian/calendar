'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n';

/**
 * BusinessShareButton — כרטיס שיתוף בסגנון "לינק בביו" (בהשראת Calmark) לעמוד
 * קביעת התורים של העסק. עצמאי לחלוטין: בונה בעצמו את הכתובת הקנונית של הפרודקשן
 * מתוך ה-slug, ומציג לוגו + שם העסק + טקסט הזמנה בעברית, עם יעדי שיתוף:
 * וואטסאפ, העתקת קישור ופייסבוק (וגם שיתוף מהיר דרך Web Share API כשקיים).
 *
 * חשוב: כל הטקסט בעברית ומיושר RTL כראוי (לא הפוך). הכתובת עצמה מוצגת LTR.
 *
 * שימוש (המיקום בעמוד מתואם בנפרד):
 *   <BusinessShareButton name="מספרת דנה" slug="demo-barbershop" logoUrl="/uploads/logo.png" />
 */

const PROD_HOST = 'https://torchick.duckdns.org';

type Props = {
  /** שם העסק כפי שיוצג ובטקסט השיתוף */
  name: string;
  /** ה-slug של העסק; ממנו נבנית הכתובת /b/<slug> */
  slug: string;
  /** כתובת הלוגו של העסק (אופציונלי) */
  logoUrl?: string | null;
  className?: string;
};

export default function BusinessShareButton({ name, slug, logoUrl, className = '' }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const shareUrl = `${PROD_HOST}/b/${slug}`;
  const displayUrl = `torchick.duckdns.org/b/${slug}`;
  const shareText = t.publicPage.share.shareText.replace('{name}', name);
  const shareTitle = t.publicPage.share.shareTitle.replace('{name}', name);
  const initial = name.trim().charAt(0) || '★';

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  async function handleNativeShare() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
    } catch {
      /* המשתמש ביטל את השיתוף — אין צורך בטיפול */
    }
  }

  async function handleCopy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div
      dir="rtl"
      className={`mx-auto w-full max-w-sm rounded-3xl border border-sand-200 bg-white p-6 text-center shadow-lg dark:border-sand-800 dark:bg-sand-900 ${className}`}
    >
      {/* לוגו העסק */}
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200 dark:bg-sand-800 dark:ring-sand-700">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-brand-600 dark:text-brand-300">{initial}</span>
        )}
      </div>

      {/* שם העסק + הזמנה */}
      <h3 className="text-lg font-bold text-sand-900 dark:text-sand-50">{name}</h3>
      <p className="mt-1 text-sm text-sand-600 dark:text-sand-300">{t.publicPage.share.subtitle}</p>

      {/* צ'יפ כתובת + העתקה */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-sand-200 bg-sand-50 p-1.5 pr-3 dark:border-sand-700 dark:bg-sand-800">
        <span dir="ltr" className="min-w-0 flex-1 truncate text-left text-sm text-sand-700 dark:text-sand-200">
          {displayUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t.publicPage.share.copyLink}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sand-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-sand-100 dark:text-sand-900 dark:hover:bg-white"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? t.publicPage.share.copied : t.publicPage.share.copyLink}</span>
        </button>
      </div>
      {copyFailed && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t.publicPage.share.copyFailed}</p>
      )}

      {/* שיתוף מהיר (Web Share API) כשזמין */}
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label={t.publicPage.share.ariaShare.replace('{name}', name)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <ShareIcon />
          <span>{t.publicPage.share.nativeShare}</span>
        </button>
      )}

      {/* יעדי שיתוף מפורשים */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
        >
          <WhatsappIcon />
          <span>{t.publicPage.share.whatsapp}</span>
        </a>
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#1877F2] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2]"
        >
          <FacebookIcon />
          <span>{t.publicPage.share.facebook}</span>
        </a>
      </div>
    </div>
  );
}

/* ---- אייקונים מוטבעים (רכיב עצמאי, ללא תלות חיצונית) ---- */

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v13M12 3l-4 4M12 3l4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.24.68-1.42 1.32-1.95 1.36-.5.04-.5.4-3.15-.66-2.65-1.06-4.32-3.75-4.45-3.93-.13-.18-1.06-1.41-1.06-2.69s.67-1.91.91-2.17c.24-.26.53-.33.7-.33.18 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.07.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.86.27.13.45.2.51.31.06.11.06.64-.18 1.32z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.9 3.78-3.9 1.09 0 2.24.19 2.24.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
