'use client';

import { useState } from 'react';

import { WhatsappIcon, EyeIcon, PlusIcon } from './icons';

/**
 * כרטיס השיתוף הראשי בעמוד הבית.
 * מכיל העתקה ללוח (clipboard), שיתוף בוואטסאפ ומעבר לעמוד הציבורי.
 * ההעתקה מפעילה toast דרך onToast מהמעטפת (HomeShell), כדי לרכז את מצב ה-toast.
 * גלולת "חי ומקבל תורים" מוצגת רק כשהעסק חי (isLive); קוד ה-QR מוצג רק כשקיים.
 * הכרטיס בנוי כמגירה נגישה (aria-expanded), סגורה כברירת מחדל; גוף הכרטיס מוצג רק כשהמגירה פתוחה.
 */
type ShareHeroProps = {
  isLive: boolean;
  urlDisplay: string;
  bookingLink: string;
  bookingPagePath: string;
  qrSvg: string;
  shareText: string;
  copiedLabel: string;
  copyFailedLabel: string;
  onToast: (message: string) => void;
};

export default function ShareHero({
  isLive,
  urlDisplay,
  bookingLink,
  bookingPagePath,
  qrSvg,
  shareText,
  copiedLabel,
  copyFailedLabel,
  onToast,
}: ShareHeroProps) {
  const [open, setOpen] = useState(false);
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${bookingLink}`)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingLink);
      onToast(copiedLabel);
    } catch {
      onToast(copyFailedLabel);
    }
  }

  return (
    <section className="share-hero">
      <h2 className="share-head">
        <button
          type="button"
          className="share-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="share-title-txt">שתפו את העסק שלכם</span>
          <PlusIcon className={`share-caret${open ? ' open' : ''}`} />
        </button>
      </h2>

      {open ? (
        <div className="share-body">
          {isLive ? (
            <span className="live">
              <span className="pulse" /> העמוד שלך חי ומקבל תורים
            </span>
          ) : null}
          <div className="sub">כל שיתוף מביא לקוחות ישירות ליומן שלכם</div>

          <div className="share-main">
            {qrSvg ? (
              <div
                className="share-qr"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : null}
            <div className="share-right">
              <div className="urlchip">
                <span className="u">{urlDisplay}</span>
                <button type="button" className="cp" onClick={handleCopy}>
                  העתקה
                </button>
              </div>
              <div className="share-acts">
                <a
                  className="sact wa"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsappIcon /> וואטסאפ
                </a>
                <a
                  className="sact view"
                  href={bookingPagePath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <EyeIcon /> העמוד שלי
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
