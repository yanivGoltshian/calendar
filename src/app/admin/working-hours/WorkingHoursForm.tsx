'use client';

import { useRef, useState } from 'react';
import { t } from '@/i18n';
import { useAdminForm } from '@/components/useAdminForm';
import type { AdminFormState } from '@/lib/adminFormState';

/** ערכי יום בודד לטופס (מחרוזות HH:MM לשדות type="time"). */
export type DayRow = {
  weekday: number;
  open: boolean;
  start: string;
  end: string;
  breaks: { start: string; end: string }[];
};

type Props = {
  scope: 'BUSINESS' | 'STAFF';
  staffId?: string;
  rows: DayRow[];
};

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const initialState: AdminFormState = { ok: false };

const timeInputClass =
  'rounded-lg border border-[#d6c8b4] px-2 py-1.5 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function EndTimeInput({
  name,
  value,
  onChange,
  ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const midnight = value === '24:00';
  return (
    <div className="space-y-1">
      <input
        type="time"
        name={midnight ? undefined : name}
        value={midnight ? '' : value}
        onChange={(event) => onChange(event.target.value)}
        disabled={midnight}
        dir="ltr"
        aria-label={ariaLabel}
        className={`${timeInputClass} w-full`}
      />
      {midnight ? <input type="hidden" name={name} value="24:00" /> : null}
      <label className="flex items-center gap-1.5 text-xs text-[#8f8478]">
        <input
          type="checkbox"
          checked={midnight}
          onChange={(event) => onChange(event.target.checked ? '24:00' : '23:59')}
          aria-label={`${t.admin.workingHours.endAtMidnight} ${ariaLabel}`}
          className="h-3.5 w-3.5 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
        />
        {t.admin.workingHours.endAtMidnight}
      </label>
    </div>
  );
}

export default function WorkingHoursForm({ scope, staffId, rows }: Props) {
  const { state, onSubmit, pending } = useAdminForm('working-hours', initialState);
  const nextBreakId = useRef(0);
  const [endByDay, setEndByDay] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.weekday, row.end])),
  );
  const [breaksByDay, setBreaksByDay] = useState<Record<number, {
    id: string;
    start: string;
    end: string;
  }[]>>(() => Object.fromEntries(rows.map((row) => [
    row.weekday,
    (row.breaks.length > 0 ? row.breaks : [{ start: '', end: '' }]).map((item, index) => ({
      id: `${row.weekday}-saved-${index}`,
      ...item,
    })),
  ])));

  function addBreak(weekday: number) {
    setBreaksByDay((current) => ({
      ...current,
      [weekday]: [
        ...current[weekday],
        { id: `${weekday}-new-${nextBreakId.current++}`, start: '', end: '' },
      ],
    }));
  }

  function updateBreak(
    weekday: number,
    id: string,
    field: 'start' | 'end',
    value: string,
  ) {
    setBreaksByDay((current) => ({
      ...current,
      [weekday]: current[weekday].map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function removeBreak(weekday: number, id: string) {
    setBreaksByDay((current) => ({
      ...current,
      [weekday]: (() => {
        const remaining = current[weekday].filter((item) => item.id !== id);
        return remaining.length > 0
          ? remaining
          : [{ id: `${weekday}-empty-${nextBreakId.current++}`, start: '', end: '' }];
      })(),
    }));
  }

  const errorText =
    state.error === 'unconfirmed'
      ? t.common.saveUnconfirmed
      : state.error === 'range'
      ? t.admin.workingHours.errorRange
      : state.error === 'break'
        ? t.admin.workingHours.errorBreak
        : state.error === 'break_overlap'
          ? t.admin.workingHours.errorBreakOverlap
          : state.error === 'noStaff'
            ? t.admin.workingHours.errorNoStaff
            : state.error
              ? t.admin.workingHours.errorGeneric
              : null;

  const successText = state.ok ? t.admin.workingHours.success : null;

  return (
    <form
      onSubmit={onSubmit}
      aria-label={t.admin.workingHours.title}
      className="mt-6 space-y-3"
    >
      {scope === 'STAFF' && staffId ? (
        <input type="hidden" name="staffId" value={staffId} />
      ) : null}

      <p className="text-sm text-[#8f8478]">{t.admin.workingHours.intro}</p>

      <ul className="space-y-3">
        {rows.map((row) => {
          const d = row.weekday;
          const weekdayName = t.admin.workingHours.weekdays[WEEKDAY_KEYS[d]];
          const breakRows = breaksByDay[d];
          const firstBreak = breakRows[0];
          return (
            <li
              key={d}
              className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
            >
              <label className="flex items-center gap-2 font-medium text-[#1b1715]">
                <input
                  type="checkbox"
                  name={`open_${d}`}
                  defaultChecked={row.open}
                  className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
                />
                {weekdayName}
              </label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#8f8478]">
                    {t.admin.workingHours.startLabel}
                  </label>
                  <input
                    type="time"
                    name={`start_${d}`}
                    defaultValue={row.start}
                    dir="ltr"
                    className={`${timeInputClass} w-full`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#8f8478]">
                    {t.admin.workingHours.endLabel}
                  </label>
                  <EndTimeInput
                    name={`end_${d}`}
                    value={endByDay[d]}
                    onChange={(value) => setEndByDay((current) => ({
                      ...current,
                      [d]: value,
                    }))}
                    ariaLabel={t.admin.workingHours.endLabel}
                  />
                </div>
              </div>

              <p className="mt-3 mb-1 text-xs font-medium text-[#8f8478]">
                {t.admin.workingHours.breakLabel}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  name={`breakStart_${d}`}
                  value={firstBreak.start}
                  onChange={(event) => updateBreak(d, firstBreak.id, 'start', event.target.value)}
                  dir="ltr"
                  aria-label={t.admin.workingHours.breakStartLabel}
                  className={`${timeInputClass} w-full`}
                />
                <EndTimeInput
                  name={`breakEnd_${d}`}
                  value={firstBreak.end}
                  onChange={(value) => updateBreak(d, firstBreak.id, 'end', value)}
                  ariaLabel={t.admin.workingHours.breakEndLabel}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addBreak(d)}
                  aria-label={`${t.admin.workingHours.addBreak} ${weekdayName}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d6c8b4] bg-[#f7f2ea] text-lg font-semibold text-[#6e655f] transition hover:border-brand-500 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <span aria-hidden="true">+</span>
                </button>
                {firstBreak.start !== '' || firstBreak.end !== '' ? (
                  <button
                    type="button"
                    onClick={() => removeBreak(d, firstBreak.id)}
                    aria-label={`${t.admin.workingHours.removeBreak} 1 ${weekdayName}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {t.admin.workingHours.removeBreak}
                  </button>
                ) : null}
              </div>
              {breakRows.slice(1).map((item, index) => {
                const number = index + 2;
                return (
                  <div key={item.id} className="mt-3 rounded-lg border border-[#e7ddcd] bg-[#fcfaf7] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-[#8f8478]">
                        {t.admin.workingHours.additionalBreakLabel} {number}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeBreak(d, item.id)}
                        aria-label={`${t.admin.workingHours.removeBreak} ${number} ${weekdayName}`}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        {t.admin.workingHours.removeBreak}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="time"
                        name={`breakStart_${d}`}
                        value={item.start}
                        onChange={(event) => updateBreak(d, item.id, 'start', event.target.value)}
                        dir="ltr"
                        aria-label={`${t.admin.workingHours.breakStartLabel} ${number}`}
                        className={`${timeInputClass} w-full`}
                      />
                      <EndTimeInput
                        name={`breakEnd_${d}`}
                        value={item.end}
                        onChange={(value) => updateBreak(d, item.id, 'end', value)}
                        ariaLabel={`${t.admin.workingHours.breakEndLabel} ${number}`}
                      />
                    </div>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>

      {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
      {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {t.admin.workingHours.save}
      </button>
    </form>
  );
}
