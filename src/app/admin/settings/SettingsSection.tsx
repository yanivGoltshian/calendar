import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * עטיפת סעיף בעמוד ההגדרות: כרטיס עם כותרת ותיאור, ובתוכו השדות (children).
 * רכיב תצוגה בלבד. השמירה מתבצעת בטופס אחד מאחד את כל הסעיפים (SettingsForm).
 */
export default function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
