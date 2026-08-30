import type { SVGProps } from 'react';

/* אייקונים inline‑SVG · הנתיבים הועתקו מילה במילה מהמוקאפ המאושר.
   אין אימוג'ים. מערכת ה-.ic (קו/מלא) מנוהלת ב-home.css. */

type IcProps = SVGProps<SVGSVGElement> & { solid?: boolean };

function Ic({ solid, className, children, ...rest }: IcProps & { children: React.ReactNode }) {
  return (
    <svg
      className={`ic${solid ? ' solid' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function BellIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Ic>
  );
}

export function MenuIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Ic>
  );
}

export function WhatsappIcon(props: IcProps) {
  return (
    <Ic solid {...props}>
      <path d="M12.04 2.02c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.16-1.35a9.94 9.94 0 0 0 4.88 1.28h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.9 9.9 0 0 0 12.04 2.02zm5.8 14.06c-.24.68-1.42 1.32-1.96 1.36-.5.04-.98.22-3.32-.7-2.8-1.1-4.6-3.98-4.74-4.16-.14-.18-1.12-1.5-1.12-2.86s.72-2.02.98-2.3c.24-.28.52-.34.7-.34l.5.01c.16 0 .38-.06.6.46.24.56.8 1.94.86 2.08.06.14.1.3.02.48-.08.18-.12.3-.24.46l-.36.42c-.12.12-.24.26-.1.5.14.24.62 1.02 1.32 1.66.9.82 1.66 1.08 1.9 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.18 1.26z" />
    </Ic>
  );
}

export function EyeIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Ic>
  );
}

export function CheckIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Ic>
  );
}

export function PlusIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M12 6v12M6 12h12" />
    </Ic>
  );
}

export function CloseIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Ic>
  );
}

export function CalendarNavIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </Ic>
  );
}

export function OrdersIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4M8.5 14l2.2 2.2 4.3-4.4" />
    </Ic>
  );
}

export function ClientsIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M15.5 20v-1.6a3.8 3.8 0 0 0-3.8-3.8H6.8A3.8 3.8 0 0 0 3 18.4V20" />
      <circle cx="9.25" cy="7.5" r="3.4" />
      <path d="M21 20v-1.6a3.8 3.8 0 0 0-2.9-3.7M16.4 4.1a3.8 3.8 0 0 1 0 6.8" />
    </Ic>
  );
}

export function ServicesIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M20 4 8.1 15.9M14.6 14.5 20 20M8.1 8.1 12.4 12.4" />
    </Ic>
  );
}

export function MoreIcon(props: IcProps) {
  return (
    <Ic solid {...props}>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </Ic>
  );
}

export function PremiumStarIcon(props: IcProps) {
  return (
    <Ic solid {...props}>
      <path d="M12 2.6l1.85 5.05L18.9 9.5l-5.05 1.85L12 16.4l-1.85-5.05L5.1 9.5l5.05-1.85z" />
      <path d="M18.6 14.4l.78 2.12 2.12.78-2.12.78-.78 2.12-.78-2.12-2.12-.78 2.12-.78z" />
    </Ic>
  );
}

export function TeamIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M16 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19" />
      <circle cx="10" cy="8" r="3.1" />
      <path d="M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3M14.8 5a3.1 3.1 0 0 1 0 6" />
    </Ic>
  );
}

export function ClockIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.3V12l3.2 2" />
    </Ic>
  );
}

export function BarsIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M3 21h18M6 21v-6M12 21V9M18 21v-9" />
    </Ic>
  );
}

export function WaitlistIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <rect x="3" y="4.5" width="18" height="4" rx="1.4" />
      <rect x="3" y="10" width="18" height="4" rx="1.4" />
      <rect x="3" y="15.5" width="11" height="4" rx="1.4" />
    </Ic>
  );
}

export function UpgradeStarIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9 6 19.2l1-5.8L2.8 9.3l5.8-.8z" />
    </Ic>
  );
}

export function HelpIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <path d="M12 17h.01" />
    </Ic>
  );
}

export function InstallIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 5.3h3M12 8.5v6M9.6 12.1 12 14.5l2.4-2.4" />
    </Ic>
  );
}

export function LogoutIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M15 12H5" />
    </Ic>
  );
}

export function SettingsIcon(props: IcProps) {
  return (
    <Ic {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Ic>
  );
}
