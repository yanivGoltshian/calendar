'use client';

import { useActionState } from 'react';
import { t } from '@/i18n';
import { formatDuration } from '@/lib/time';
import { formatAgorot } from '@/lib/money';
import {
  createManualAppointmentAction,
  type CreateApptState,
} from './actions';

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
};

type Props = {
  staffId: string;
  staffName: string;
  date: string;
  services: ServiceOption[];
};

const initialState: CreateApptState = { ok: false };

export default function NewAppointmentForm({ staffId, staffName, date, services }: Props) {
  const [state, formAction, pending] = useActionState(
    createManualAppointmentAction,
    initialState,
  );

  const errorText =
    state.error === 'slot_taken'
      ? t.admin.form.errorSlotTaken
      : state.error
        ? t.admin.form.errorGeneric
        : null;

  return (
    <details className="mt-6 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-brand-600">
        + {t.admin.newAppointment}
        <span className="mr-1 text-sm font-normal text-slate-400"> · {staffName}</span>
      </summary>

      <form action={formAction} className="space-y-3 border-t border-slate-100 p-4">
        <input type="hidden" name="staffId" value={staffId} />
        <input type="hidden" name="date" value={date} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.form.clientName}
          </label>
          <input
            name="clientName"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.form.clientPhone}
          </label>
          <input
            name="clientPhone"
            required
            inputMode="tel"
            dir="ltr"
            placeholder={t.auth.phonePlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.form.service}
            </label>
            <select
              name="serviceId"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)} · {formatAgorot(s.priceAgorot)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.form.time}
            </label>
            <input
              name="time"
              type="time"
              required
              dir="ltr"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{t.admin.form.success}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.common.loading : t.admin.form.submit}
        </button>
      </form>
    </details>
  );
}
