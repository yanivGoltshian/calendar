'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TIMEZONE,
  filterTimezoneOptions,
  getTimezoneOptions,
  labelForTimezone,
} from '@/lib/timezones';
import { inputClass } from './fieldStyles';

/**
 * תיבת בחירה מחיפוש לאזורי זמן IANA עם סינון בהקלדה.
 * ברירת המחדל היא ישראל (Asia/Jerusalem). נשמר מזהה ה-IANA כמחרוזת כמקודם.
 */
export function TimezoneField({
  name,
  defaultValue,
  searchPlaceholder,
  selectedLabel,
  noResultsLabel,
}: {
  name: string;
  defaultValue: string;
  searchPlaceholder: string;
  selectedLabel: string;
  noResultsLabel: string;
}) {
  const zones = useMemo(() => getTimezoneOptions(), []);
  const [selected, setSelected] = useState<string>(
    defaultValue || DEFAULT_TIMEZONE,
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(
    () => filterTimezoneOptions(zones, query).slice(0, 60),
    [zones, query],
  );

  const selectedLabelText = useMemo(
    () => labelForTimezone(selected),
    [selected],
  );

  function choose(tz: string) {
    setSelected(tz);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected} />
      <input
        dir="auto"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        value={query}
        placeholder={searchPlaceholder}
        onFocus={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results[0]) choose(results[0].id);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={inputClass}
      />

      <p className="mt-1 text-xs text-slate-500">
        {selectedLabel}{' '}
        <span className="font-medium text-slate-700">{selectedLabelText}</span>{' '}
        <span dir="ltr" className="text-slate-400">
          {selected}
        </span>
      </p>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">
              {noResultsLabel}
            </li>
          ) : (
            results.map((tz) => (
              <li key={tz.id} role="option" aria-selected={tz.id === selected}>
                <button
                  type="button"
                  dir="rtl"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(tz.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-brand-50 ${
                    tz.id === selected
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-slate-700'
                  }`}
                >
                  <span>{tz.label}</span>
                  <span dir="ltr" className="text-xs text-slate-400">
                    {tz.id}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
