import type { SectionIconKey } from '@/lib/publicPageStyle';

// אייקוני SVG משותפים לעמוד העסק הציבורי ולמקטעי הנחיתה. שרת-בטוחים (ללא hooks).

export type IconProps = { className?: string };

function svgProps(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9Z" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function NavigationIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 11l19-9-9 19-2-8-8-2Z" />
    </svg>
  );
}

export function WhatsappIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.8.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.5 7.5 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.4a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3A2.9 2.9 0 0 0 5.6 10a5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c.6.3 1.1.4 1.5.5a3.5 3.5 0 0 0 1.6.1c.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3Z" />
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 8.5V7c0-.8.2-1.2 1.4-1.2H17V3h-2.5C11.7 3 11 4.4 11 6.5v2H9v3h2v9h3v-9h2.3l.4-3H14Z" />
    </svg>
  );
}

export function TiktokIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 3c.3 2 1.5 3.5 3.5 3.8v2.6c-1.3 0-2.5-.4-3.5-1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.7a3 3 0 1 0 2.1 2.9V3h2.7Z" />
    </svg>
  );
}

export function ScissorsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1 21 21M8.1 15.9 21 3" />
    </svg>
  );
}

export function DumbbellIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 9v6M7 5v14M17 5v14M20 9v6M7 12h10" />
    </svg>
  );
}

export function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M3 3h2.5M13.5 3H16" />
      <path d="M9.5 14v1a5.5 5.5 0 0 0 5.5 5.5 3.5 3.5 0 0 0 3.5-3.5V13" />
      <circle cx="18.5" cy="11" r="2" />
    </svg>
  );
}

export function LeafIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 20c0-8 6-14 16-16-2 10-8 16-16 16Z" />
      <path d="M4 20 14 10" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
    </svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M10 3l1.4 3.9L15 8.3l-3.6 1.4L10 13.6 8.6 9.7 5 8.3l3.6-1.4Z" />
      <path d="M17.5 13l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function NeedleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 21l5-5" />
      <path d="M8 16 18 6a2.1 2.1 0 0 0-3-3L5 13Z" />
      <path d="M6 12l3 3" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
    </svg>
  );
}

export function SectionIcon({ iconKey, className }: { iconKey: SectionIconKey; className?: string }) {
  switch (iconKey) {
    case 'scissors':
      return <ScissorsIcon className={className} />;
    case 'dumbbell':
      return <DumbbellIcon className={className} />;
    case 'stethoscope':
      return <StethoscopeIcon className={className} />;
    case 'leaf':
      return <LeafIcon className={className} />;
    case 'sparkle':
      return <SparkleIcon className={className} />;
    case 'eye':
      return <EyeIcon className={className} />;
    case 'needle':
      return <NeedleIcon className={className} />;
    case 'sparkles':
      return <SparklesIcon className={className} />;
    case 'calendar':
    default:
      return <CalendarIcon className={className} />;
  }
}
