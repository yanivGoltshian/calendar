import { WhatsappIcon } from './icons';

type Props = { href: string; ariaLabel: string };

// כפתור צף לפתיחת שיחת וואטסאפ — מוצג רק כשלעסק הוגדר קישור וואטסאפ.
// ממוקם מעל סרגל ה-CTA התחתון הקבוע כדי לא להסתיר אותו.
export default function WhatsAppFab({ href, ariaLabel }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="fixed bottom-24 start-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--biz)] text-[color:var(--biz-ink)] shadow-elevated ring-4 ring-[var(--biz-soft)] transition duration-200 hover:scale-105 active:scale-95"
    >
      <WhatsappIcon className="h-6 w-6" />
    </a>
  );
}
