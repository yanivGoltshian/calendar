/**
 * אייקוני אשף עמוד הפרימיום — פורט נאמן לספרייט של המוקאפ המאושר
 * (`premium-builder.html`). אייקוני מותג צבעוניים (גוגל/אינסטגרם/פייסבוק/
 * טיקטוק/וואטסאפ) ואייקוני תפעול חד-צבעיים (currentColor). מחליפים אימוג'ים.
 */
import type { SVGProps } from 'react';

type IconProps = { className?: string } & SVGProps<SVGSVGElement>;

/* ── מותג · צבעוני ── */

export function GoogleGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" {...rest}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.3 5.3C41.9 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function InstagramGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <defs>
        <linearGradient id="tc-ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset=".45" stopColor="#fa7e1e" />
          <stop offset=".7" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#tc-ig-grad)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1.15" fill="#fff" />
    </svg>
  );
}

export function FacebookGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.4 12.4l.44-2.8h-2.7V7.78c0-.77.38-1.52 1.58-1.52h1.22V3.88s-1.1-.19-2.16-.19c-2.2 0-3.64 1.34-3.64 3.75V9.6H7.6v2.8h2.44V19h3v-6.6z"
      />
    </svg>
  );
}

export function TiktokGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect width="24" height="24" rx="6" fill="#111" />
      <path
        fill="#fff"
        d="M17.7 8.9a3.9 3.9 0 0 1-2.98-1.37v4.98a4.35 4.35 0 1 1-4.35-4.35c.16 0 .32 0 .48.03v2.2a2.16 2.16 0 1 0 1.67 2.1V4h2.06a3.9 3.9 0 0 0 3.1 3.8z"
      />
    </svg>
  );
}

export function WhatsappGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path
        fill="#fff"
        d="M12 5.6a6.3 6.3 0 0 0-5.4 9.5L5.8 18l3-.8A6.3 6.3 0 1 0 12 5.6zm0 1.6a4.7 4.7 0 1 1-2.44 8.72l-.3-.18-1.48.39.4-1.44-.2-.3A4.7 4.7 0 0 1 12 7.2zm-1.86 2.24c-.13 0-.34.05-.52.24-.18.2-.68.67-.68 1.62s.7 1.88.8 2.01c.1.13 1.36 2.08 3.32 2.92 1.63.7 1.96.56 2.32.53.36-.03 1.16-.47 1.32-.93.16-.46.16-.85.12-.93-.05-.08-.18-.13-.38-.23s-1.16-.57-1.34-.64c-.18-.06-.31-.1-.44.1-.13.19-.5.63-.62.76-.11.13-.23.15-.42.05-.2-.1-.83-.3-1.58-.98-.58-.52-.98-1.16-1.1-1.36-.11-.19-.01-.3.09-.39.09-.09.2-.23.29-.35.1-.12.13-.2.2-.34.06-.13.03-.25-.02-.35s-.44-1.08-.61-1.48c-.16-.38-.32-.33-.44-.33z"
      />
    </svg>
  );
}

/* ── תפעול · currentColor ── */

export function StarGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="currentColor"
        d="M12 2.6l2.7 5.9 6.3.9-4.6 4.4 1.1 6.3L12 17.9 6.5 20.1l1.1-6.3L3 9.4l6.3-.9z"
      />
    </svg>
  );
}

export function ImageGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="10" r="1.7" fill="currentColor" />
      <path
        d="M4 17l4.6-4.4 2.9 2.9L15 11l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VideoGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M16 10.4l4.3-2.5v8.2L16 13.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImageVideoGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.9 10.1l3 1.9-3 1.9z" fill="currentColor" />
    </svg>
  );
}

export function PaletteGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.7 0 2-1.15 1.2-1.98-.8-.9-.5-2 .82-2H16a4.9 4.9 0 0 0 4.9-4.9c0-4.3-3.98-5.9-8.9-5.9z"
      />
      <circle cx="7.6" cy="12" r="1.05" fill="currentColor" />
      <circle cx="9.9" cy="8.2" r="1.05" fill="currentColor" />
      <circle cx="14.3" cy="7.9" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function PinGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"
      />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function PhoneGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="currentColor"
        d="M6.7 3.6c.5 0 .92.32 1.03.8l.86 3c.11.42-.02.86-.33 1.13L7 9.7c1 1.98 2.5 3.48 4.5 4.55l1.15-1.28c.28-.3.72-.42 1.13-.3l3 .87c.48.13.8.55.8 1.04V18c0 1.2-1.02 2.22-2.24 2.02C9.7 19.3 4.7 14.3 4 7.72 3.84 6.5 4.86 5.5 6.06 5.5z"
      />
    </svg>
  );
}

export function UploadGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15V4m0 0L8 8m4-4l4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
      />
    </svg>
  );
}

export function PlusGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EditGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17z"
      />
      <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M13.4 7.6l3 3" />
    </svg>
  );
}

export function TrashGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 7h14M10 7V5h4v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 11v6M14 11v6"
      />
    </svg>
  );
}

export function CheckGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 6 9 17l-5-5"
      />
    </svg>
  );
}

/** אייקון "i" קטן לכפתור-מידע ליד שם קישור (פותח הסבר איך להביא את הלינק). */
export function InfoGlyph({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="8" r="1.15" fill="currentColor" />
      <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M12 11.4v5" />
    </svg>
  );
}
