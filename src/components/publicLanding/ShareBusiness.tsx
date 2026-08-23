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

  const pill =
    'inline-flex items-center gap-2 rounded-full border border-[#e7ddcd] bg-[#fbf7f0] px-4 py-2.5 text-sm font-bold text-[#4a423c] transition hover:bg-[#f3ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b0855f]/40';

  return (
    <section
      dir="rtl"
      aria-label={s.ariaShare.replace('{name}', businessName)}
      className="rounded-[22px] border border-[#e7ddcd] bg-[#faf6ef] px-5 py-8 text-center shadow-[0_18px_40px_-30px_rgba(40,28,18,0.5)] sm:px-8"
    >
      {/* כותרת מקטע — פס זהב ממורכז כמו בעיצוב */}
      <div className="text-[0.85rem] font-extrabold text-[#c6a86a]">{s.eyebrow}</div>
      <h2 className="mt-1 text-2xl font-extrabold text-[#211c1a]">{s.title}</h2>
      <div className="mx-auto mt-3 h-[3px] w-20 rounded-full bg-[linear-gradient(90deg,transparent,#c6a86a,transparent)]" />

      {/* כרטיס השיתוף */}
      <div className="mx-auto mt-7 max-w-[560px]">
        <p className="text-sm font-semibold text-[#6e655f]">{s.subtitle}</p>

        {/* שורת הקישור — הצגת הכתובת + כפתור העתקה במותג */}
        <div className="mx-auto mt-4 flex max-w-[520px] items-center gap-2">
          <span
            dir="ltr"
            className="min-w-0 flex-1 truncate rounded-xl border border-[#e7ddcd] bg-[#fbf7f0] px-3.5 py-2.5 text-left text-sm font-medium text-[#4a423c]"
          >
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={s.copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#b0855f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#8c6748] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b0855f]/50"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {copied ? s.copied : s.copyLink}
          </button>
        </div>

        {/* כפתורי רשתות — גלולות בפלטת הקרם */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {canShare ? (
            <button type="button" onClick={handleNativeShare} className={pill}>
              <ShareIcon className="h-4 w-4 text-[#b0855f]" />
              {s.button}
            </button>
          ) : null}
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={pill}>
            <WhatsappIcon className="h-4 w-4 text-[#25D366]" />
            {s.whatsapp}
          </a>
          <a href={fbHref} target="_blank" rel="noopener noreferrer" className={pill}>
            <FacebookIcon className="h-4 w-4 text-[#1877F2]" />
            {s.facebook}
          </a>
          <button type="button" onClick={handleInstagram} className={pill}>
            <InstagramIcon className="h-4 w-4 text-[#E4405F]" />
            {s.instagram}
          </button>
        </div>

        {copyFailed ? (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {s.copyFailed}
          </p>
        ) : null}
        {igHint ? (
          <p role="status" className="mt-3 text-sm text-[#6e655f]">
            {s.instagramHint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
