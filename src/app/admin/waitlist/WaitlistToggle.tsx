import { setWaitlistEnabledAction } from './actions';

type Props = {
  /** מצב נוכחי של רשימת ההמתנה לעסק (מקור: BusinessSettings.waitlistEnabled). */
  enabled: boolean;
  /** תווית עברית לטוגל (מגיעה מהמילון, ללא מחרוזת קשיחה ברכיב). */
  label: string;
};

/**
 * טוגל הפעלה/כיבוי של רשימת ההמתנה בראש עמוד הניהול. טופס-שרת פשוט (ללא
 * 'use client') התואם למתגים הקיימים במערכת: שדה מוסתר `enabled` נושא את מצב
 * היעד, וכפתור השליחה מעוצב כמתג. הטוגל נשאר פעיל תמיד כדי לאפשר הדלקה מחדש.
 */
export default function WaitlistToggle({ enabled, label }: Props) {
  return (
    <form
      action={setWaitlistEnabledAction}
      className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] bg-white px-4 py-3"
    >
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <p className="text-sm font-bold text-[#1b1715]">{label}</p>
      <button
        type="submit"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={
          enabled
            ? 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-brand-600 transition'
            : 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-[#d6c8b4] transition'
        }
      >
        <span
          className={
            enabled
              ? 'inline-block h-5 w-5 -translate-x-0.5 transform rounded-full bg-white shadow transition'
              : 'inline-block h-5 w-5 -translate-x-5 transform rounded-full bg-white shadow transition'
          }
        />
      </button>
    </form>
  );
}
