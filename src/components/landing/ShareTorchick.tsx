'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Container, Section } from '@/components/ui';
import { t } from '@/i18n';

const s = t.marketing.share;

type IconProps = { className?: string };

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.14-.19.29-.74.93-.9 1.12-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49-.16-.01-.36-.01-.55-.01-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.41 0 1.42 1.04 2.79 1.18 2.98.15.19 2.04 3.12 4.95 4.37.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.7-.7 1.95-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12.05 21.5h-.01a9.44 9.44 0 01-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 01-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 012.77 6.7c-.01 5.22-4.26 9.47-9.48 9.47zm8.06-17.53A11.36 11.36 0 0012.05.6C5.8.6.72 5.68.72 11.93c0 2 .52 3.95 1.52 5.67L.62 23.4l5.94-1.56a11.3 11.3 0 005.48 1.4h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.9 3.78-3.9 1.09 0 2.24.19 2.24.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function LinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

export function ShareTorchick({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  const shareText = s.shareText;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // אם ההעתקה נכשלה, אפשר עדיין להשתמש בכפתורי השיתוף.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: 'תור צ׳יק', text: shareText, url: shareUrl });
    } catch {
      // המשתמש ביטל את השיתוף או שהדפדפן חסם — לא נדרשת פעולה.
    }
  }

  return (
    <Section spacing="sm">
      <Container>
        <div className="mx-auto max-w-3xl rounded-3xl border border-brand-100 bg-brand-50/60 p-8 text-center sm:p-10">
          <Badge>{s.badge}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">{s.heading}</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600">
            {s.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {canNativeShare && (
              <Button variant="secondary" size="md" onClick={handleNativeShare}>
                <span className="inline-flex items-center gap-2">
                  <ShareIcon className="h-5 w-5" />
                  {s.native}
                </span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5" />
                {s.whatsapp}
              </span>
            </Button>

            <Button variant="outline" size="md" onClick={handleCopy} aria-live="polite">
              <span className="inline-flex items-center gap-2">
                {copied ? <CheckIcon className="h-5 w-5" /> : <LinkIcon className="h-5 w-5" />}
                {copied ? s.copied : s.copy}
              </span>
            </Button>

            <Button
              variant="outline"
              size="md"
              href={facebookHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="inline-flex items-center gap-2">
                <FacebookIcon className="h-5 w-5" />
                {s.facebook}
              </span>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default ShareTorchick;
