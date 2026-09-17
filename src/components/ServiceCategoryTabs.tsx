'use client';

import { t } from '@/i18n';
import { filterCategoryServices, type ServiceCategory } from '@/lib/serviceCategories';

type Props = {
  categories: readonly ServiceCategory[];
  services: readonly { id: string }[];
  selected: string;
  onSelect: (id: string) => void;
};

export default function ServiceCategoryTabs({ categories, services, selected, onSelect }: Props) {
  if (!categories.length) return null;
  const labels = t.serviceCategories;
  const options = [
    { id: 'all', name: labels.all },
    ...categories,
    { id: 'uncategorized', name: labels.uncategorized },
  ];
  return (
    <div
      role="group"
      aria-label={labels.browse}
      className="my-4 flex max-w-full gap-2 overflow-x-auto pb-2"
    >
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected === option.id}
          onClick={event => {
            onSelect(option.id);
            event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }}
          className={'shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--biz)] ' +
            (selected === option.id
              ? 'border-[color:var(--biz)] bg-[var(--biz)] text-[color:var(--biz-ink)]'
              : 'border-[color:var(--biz-border)] bg-[color:var(--c-surface,#fff)] text-[color:var(--c-ink,#1b1715)] hover:bg-[var(--biz-soft)]')}
        >
          {option.name}
          <span className="ms-2 text-xs opacity-70">
            {filterCategoryServices(services, categories, option.id).length}
          </span>
        </button>
      ))}
    </div>
  );
}

export function EmptyServiceCategory({ onReset }: { onReset: () => void }) {
  return (
    <div role="status" className="py-6 text-center text-sm text-[color:var(--c-muted,#64748b)]">
      <p>{t.serviceCategories.empty}</p>
      <button type="button" className="mt-2 font-semibold underline" onClick={onReset}>
        {t.serviceCategories.showAll}
      </button>
    </div>
  );
}
