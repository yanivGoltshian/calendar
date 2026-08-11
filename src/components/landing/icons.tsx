import type { SVGProps, ReactNode } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * סט אייקונים קוויים אחיד לעמוד השיווקי, במקום אימוג׳י.
 * כולם 24x24, stroke=currentColor, מעוגלים, ומקבלים className לשליטה בגודל ובצבע.
 * דקורטיביים כברירת מחדל (aria-hidden), הטקסט לצידם נושא את המשמעות.
 */
function Base({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** מספרה — מספריים */
export function ScissorsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </Base>
  );
}

/** ברברשופ — מסרק */
export function CombIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8.5h16" />
      <path d="M6 8.5v4M9 8.5v6.5M12 8.5v4M15 8.5v6.5M18 8.5v4" />
    </Base>
  );
}

/** קוסמטיקה וטיפוח — טיפה */
export function DropletIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3s6 5.2 6 9.5a6 6 0 0 1-12 0C6 8.2 12 3 12 3z" />
      <path d="M10.5 13.5a1.9 1.9 0 0 0 1.9 1.9" />
    </Base>
  );
}

/** איפור ויופי — שפתון */
export function LipstickIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 10V6.2a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2V10" />
      <rect x="8.5" y="10" width="7" height="10" rx="1.5" />
      <path d="M9 14.5h6" />
    </Base>
  );
}

/** מניקור — בקבוקון לק */
export function NailPolishIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="8.5" y="9" width="7" height="11" rx="2" />
      <rect x="10.5" y="3.5" width="3" height="3" rx="1" />
      <path d="M12 6.5V9" />
      <path d="M9.5 13h5" />
    </Base>
  );
}

/** מאמני כושר — משקולת */
export function DumbbellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </Base>
  );
}

/** מספרות וטיפוח כלבים — כף רגל */
export function PawIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6.5" cy="10" r="1.6" />
      <circle cx="10" cy="7.3" r="1.6" />
      <circle cx="14" cy="7.3" r="1.6" />
      <circle cx="17.5" cy="10" r="1.6" />
      <path d="M12 20c-2.5 0-4.6-1.5-4.6-3.6 0-1.9 2.1-3.4 4.6-3.4s4.6 1.5 4.6 3.4C16.6 18.5 14.5 20 12 20z" />
    </Base>
  );
}

/** עוד תחומים — רשת קטגוריות */
export function GridPlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <path d="M17 14v6M14 17h6" />
    </Base>
  );
}

/** קביעת תור — יומן עם וי */
export function CalendarCheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
      <path d="m9 15.5 2 2 4-4" />
    </Base>
  );
}

/** יומן חכם — ימים */
export function CalendarDaysIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01" />
    </Base>
  );
}

/** תזכורות — פעמון */
export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5H3.5S6 15.5 6 9" />
      <path d="M10.2 21a2 2 0 0 0 3.6 0" />
    </Base>
  );
}

/** עמוד עסק מעוצב — פריסת עמוד */
export function LayoutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
      <path d="M3 9.5h18M9 20.5V9.5" />
    </Base>
  );
}

/** ניצוץ — לתגיות ולהדגשות */
export function SparkleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5l1.5 4.6 4.6 1.5-4.6 1.5L12 15.7l-1.5-4.6L5.9 9.6l4.6-1.5z" />
      <path d="M18.5 15.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
    </Base>
  );
}

/** חץ קדימה (RTL — שמאלה) */
export function ArrowNextIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Base>
  );
}

type IconComponent = (props: IconProps) => ReactNode;

/** מיפוי אייקוני קהלים לפי מפתח (תואם ל-audiences ב-i18n). */
export const audienceIcons: Record<string, IconComponent> = {
  hair: ScissorsIcon,
  barber: CombIcon,
  cosmetics: DropletIcon,
  beauty: LipstickIcon,
  nails: NailPolishIcon,
  trainers: DumbbellIcon,
  dogs: PawIcon,
  more: GridPlusIcon,
};

/** מיפוי אייקוני יתרונות לפי מפתח (תואם ל-features ב-i18n). */
export const featureIcons: Record<string, IconComponent> = {
  booking: CalendarCheckIcon,
  calendar: CalendarDaysIcon,
  reminders: BellIcon,
  page: LayoutIcon,
};
