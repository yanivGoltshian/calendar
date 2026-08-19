'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TIMEZONE,
  filterTimezones,
  getTimezones,
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
  const zones = useMemo(() => getTimezones(), []);
  const [selected, setSelected] = useState<string>(
    defaultValue || DEFAULT_TIMEZONE,
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(
    () => filterTimezones(zones, query).slice(0, 60),
    [zones, query],
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
        dir="ltr"
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
            if (results[0]) choose(results[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={inputClass}
      />

      <p className="mt-1 text-xs text-slate-500">
        {selectedLabel}{' '}
        <span dir="ltr" className="font-medium text-slate-700">
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
              <li key={tz} role="option" aria-selected={tz === selected}>
                <button
                  type="button"
                  dir="ltr"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(tz)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                    tz === selected
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-slate-700'
                  }`}
                >
                  {tz}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
