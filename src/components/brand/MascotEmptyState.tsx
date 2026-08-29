import { Mascot, type MascotPose } from './Mascot';

/**
 * מצב ריק אחיד עם הקמע "שון" — כותרת מנחה קצרה ומשפט עידוד עדין בעברית.
 * מחליף פסקת מצב-ריק פשוטה בעמודי הניהול. תוספתי בלבד, ללא שינוי התנהגות.
 * הסגנון ניטרלי (slate) כדי להשתלב בעמודי הניהול מבלי להיראות ילדותי.
 */
type MascotEmptyStateProps = {
  title: string;
  body: string;
  pose?: MascotPose;
  size?: number;
  className?: string;
};

export function MascotEmptyState({
  title,
  body,
  pose = 'full',
  size = 132,
  className,
}: MascotEmptyStateProps) {
  return (
    <div
      className={`flex animate-fade-up flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center ${className ?? ''}`}
    >
      <Mascot pose={pose} size={size} className="opacity-90" />
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}

export default MascotEmptyState;
