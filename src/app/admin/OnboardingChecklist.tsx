import Link from 'next/link';
import { t } from '@/i18n';
import { dismissOnboardingChecklistAction } from './onboarding/actions';

/**
 * רשימת המשך מודרכת להקמת העסק (אונבורדינג קליל) בלוח הניהול.
 * מציגה את הצעדים שהעסק צריך (שירותים, צוות, שעות פעילות, מיתוג, פרטים ומדיניות),
 * עם קישור עומק לכל צעד שטרם הושלם וכפתור הסתרה. כל צעד ניתן לדילוג והשלמה מאוחרת,
 * והמצב מחושב בצד השרת כדי שהרשימה תתעדכן וניתנת להמשך מכל מכשיר.
 * הרשימה נעלמת אוטומטית כשכל הצעדים הושלמו או כשהבעלים בוחר להסתירה.
 */

export type ChecklistItemKey =
  | 'services'
  | 'staff'
  | 'workingHours'
  | 'branding'
  | 'details';

export interface ChecklistItem {
  key: ChecklistItemKey;
  done: boolean;
  href: string;
}

export default function OnboardingChecklist({
  items,
}: {
  items: ChecklistItem[];
}) {
  const c = t.admin.onboarding.checklist;
  const total = items.length;
  const doneCount = items.filter((i) => i.done).length;
  const progress = c.progress
    .replace('{done}', String(doneCount))
    .replace('{total}', String(total));

  return (
    <section className="mb-5 rounded-2xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1b1715]">{c.heading}</h2>
          <p className="mt-1 text-sm text-[#8f8478]">{c.subtitle}</p>
        </div>
        <form action={dismissOnboardingChecklistAction}>
          <button
            type="submit"
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-[#b3a690] transition hover:text-[#6e655f]"
          >
            {c.dismiss}
          </button>
        </form>
      </div>

      <p className="mt-3 text-sm font-semibold text-brand-700">{progress}</p>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#efe6d8] bg-[#f7f2ea] px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm text-[#4a4038]">
              <span
                aria-hidden
                className={
                  item.done
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white'
                    : 'flex h-5 w-5 items-center justify-center rounded-full border border-[#d6c8b4] text-xs text-transparent'
                }
              >
                ✓
              </span>
              <span className={item.done ? 'text-[#b3a690] line-through' : ''}>
                {c.items[item.key]}
              </span>
            </span>
            {item.done ? (
              <span className="text-xs font-medium text-emerald-600">
                {c.done}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-sm font-semibold text-brand-600 underline underline-offset-2 transition hover:text-brand-700"
              >
                {c.go}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
