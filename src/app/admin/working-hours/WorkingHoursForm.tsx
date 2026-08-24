'use client';

import { useActionState } from 'react';
import { t } from '@/i18n';
import { saveWorkingHoursAction, type SaveWorkingHoursState } from './actions';

/** ערכי יום בודד לטופס (מחרוזות HH:MM לשדות type="time"). */
export type DayRow = {
  weekday: number;
  open: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
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

const initialState: SaveWorkingHoursState = { ok: false };

const timeInputClass =
  'rounded-lg border border-[#d6c8b4] px-2 py-1.5 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function WorkingHoursForm({ scope, staffId, rows }: Props) {
  const [state, formAction, pending] = useActionState(
    saveWorkingHoursAction,
    initialState,
  );

  const errorText =
    state.error === 'range'
      ? t.admin.workingHours.errorRange
      : state.error === 'break'
        ? t.admin.workingHours.errorBreak
        : state.error === 'noStaff'
          ? t.admin.workingHours.errorNoStaff
          : state.error
            ? t.admin.workingHours.errorGeneric
            : null;

  const successText = state.ok ? t.admin.workingHours.success : null;

  return (
    <form action={formAction} className="mt-6 space-y-3">
      {scope === 'STAFF' && staffId ? (
        <input type="hidden" name="staffId" value={staffId} />
      ) : null}

      <p className="text-sm text-[#8f8478]">{t.admin.workingHours.intro}</p>

      <ul className="space-y-3">
        {rows.map((row) => {
          const d = row.weekday;
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
                {t.admin.workingHours.weekdays[WEEKDAY_KEYS[d]]}
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
                  <input
                    type="time"
                    name={`end_${d}`}
                    defaultValue={row.end}
                    dir="ltr"
                    className={`${timeInputClass} w-full`}
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
                  defaultValue={row.breakStart}
                  dir="ltr"
                  aria-label={t.admin.workingHours.breakStartLabel}
                  className={`${timeInputClass} w-full`}
                />
                <input
                  type="time"
                  name={`breakEnd_${d}`}
                  defaultValue={row.breakEnd}
                  dir="ltr"
                  aria-label={t.admin.workingHours.breakEndLabel}
                  className={`${timeInputClass} w-full`}
                />
              </div>
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
