'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { WhatsappIcon, FacebookIcon, InstagramIcon, CheckIcon } from './icons';

type ShareBusinessProps = {
  /** הכתובת הקנונית של עמוד העסק, למשל https://torchick.duckdns.org/b/demo */
  shareUrl: string;
  /** שם העסק, לשילוב בטקסט השיתוף */
  businessName: string;
};

// אייקונים מקומיים (שיתוף, קישור, X) מוגדרים כאן כדי לא לגעת בקובץ האייקונים המשותף.
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/**
 * מקטע "שיתוף" לעמוד העסק הציבורי.
 * משתמש ב-Web Share API במובייל כשקיים, עם נפילה חיננית: העתקת קישור
 * וכפתורי שיתוף מפורשים לוואטסאפ, פייסבוק, X ואינסטגרם.
 * משני לחלוטין ל-CTA של קביעת התור, שנשאר לב העמוד.
 */
export default function ShareBusiness({ shareUrl, businessName }: ShareBusinessProps) {
  const s = t.publicPage.share;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [igHint, setIgHint] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareText = s.shareText.replace('{name}', businessName);
  const shareTitle = s.shareTitle.replace('{name}', businessName);

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copyToClipboard(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      }
    } catch {
      /* נטופל בנפילה למטה */
    }
    return false;
  }

  function flashCopied() {
    setCopied(true);
    setCopyFailed(false);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2200);
  }

  async function handleCopy() {
    const ok = await copyToClipboard();
    if (ok) flashCopied();
    else setCopyFailed(true);
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
    } catch {
      /* המשתמש ביטל את השיתוף */
    }
  }

  async function handleInstagram() {
    const ok = await copyToClipboard();
    if (ok) {
      setIgHint(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setIgHint(false), 3200);
    }
    if (typeof window !== 'undefined') {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  const tileClass =
    'flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <section
      dir="rtl"
      aria-label={s.ariaShare.replace('{name}', businessName)}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ShareIcon className="h-5 w-5 text-slate-500" />
            {s.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{s.subtitle}</p>
        </div>
        {canShare ? (
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          >
            <ShareIcon className="h-4 w-4" />
            {s.button}
          </button>
        ) : null}
      </div>

      {/* כרטיס "לינק בביו" קומפקטי — נוח לצילום מסך ולשיתוף */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">{s.linkInBioTitle}</p>
        <div className="flex items-center gap-2">
          <span
            dir="ltr"
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800"
          >
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={s.copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <LinkIcon className="h-3.5 w-3.5" />
            )}
            {copied ? s.copied : s.copyLink}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">{s.linkInBioHint}</p>
      </div>

      {/* כפתורי רשתות חברתיות מפורשים (נפילה חיננית ל-Web Share) */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={tileClass}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
            <WhatsappIcon className="h-5 w-5" />
          </span>
          {s.whatsapp}
        </a>
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className={tileClass}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
            <FacebookIcon className="h-5 w-5" />
          </span>
          {s.facebook}
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          className={tileClass}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/5 text-slate-900">
            <XIcon className="h-4 w-4" />
          </span>
          {s.x}
        </a>
        <button type="button" onClick={handleInstagram} className={tileClass}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E4405F]/10 text-[#E4405F]">
            <InstagramIcon className="h-5 w-5" />
          </span>
          {s.instagram}
        </button>
      </div>

      {copyFailed ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {s.copyFailed}
        </p>
      ) : null}
      {igHint ? (
        <p role="status" className="mt-3 text-sm text-slate-600">
          {s.instagramHint}
        </p>
      ) : null}
    </section>
  );
}
