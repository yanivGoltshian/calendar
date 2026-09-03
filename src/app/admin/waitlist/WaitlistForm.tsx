'use client';

import { useActionState, useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { addWaitlistAction, type AddWaitlistState } from './actions';

export type WaitlistOption = { id: string; name: string };

type Props = {
  services: WaitlistOption[];
  staff: WaitlistOption[];
};

const initialState: AddWaitlistState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function WaitlistForm({ services, staff }: Props) {
  const w = t.admin.waitlistModule;
  const [state, formAction, pending] = useActionState(addWaitlistAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const errorText =
    state.error === 'name'
      ? w.errorName
      : state.error === 'phone'
        ? w.errorPhone
        : state.error === 'email'
          ? w.errorEmail
          : state.error
            ? w.errorGeneric
            : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1b1715]">{w.addTitle}</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.nameLabel}</label>
            <input name="name" required maxLength={120} placeholder={w.namePlaceholder} className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.phoneLabel}</label>
            <input
              name="phone"
              required
              dir="ltr"
              inputMode="tel"
              placeholder={w.phonePlaceholder}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.emailLabel}</label>
          <input
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            maxLength={200}
            placeholder={w.emailPlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.serviceLabel}</label>
            <select name="serviceId" defaultValue="" className={inputClass}>
              <option value="">{w.serviceNone}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.staffLabel}</label>
            <select name="staffId" defaultValue="" className={inputClass}>
              <option value="">{w.staffNone}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.desiredDateLabel}</label>
          <input name="desiredDate" type="date" dir="ltr" className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{w.noteLabel}</label>
          <textarea name="note" rows={2} maxLength={500} className={inputClass} />
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{w.successAdded}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.common.loading : w.submitAdd}
        </button>
      </form>
    </section>
  );
}
