'use client';

import { useActionState, useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { createPunchCardAction, type CreatePunchCardState } from './actions';

export type PunchCardOption = { id: string; name: string };

type Props = {
  clients: PunchCardOption[];
  services: PunchCardOption[];
};

const initialState: CreatePunchCardState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function PunchCardForm({ clients, services }: Props) {
  const p = t.admin.punchCardsModule;
  const [state, formAction, pending] = useActionState(createPunchCardAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const errorText =
    state.error === 'client'
      ? p.errorClient
      : state.error === 'total'
        ? p.errorTotal
        : state.error
          ? p.errorGeneric
          : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1b1715]">{p.addTitle}</h2>

      {clients.length === 0 ? (
        <p className="text-sm text-[#8f8478]">{p.noClients}</p>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.clientLabel}</label>
            <select name="clientId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                {p.clientPlaceholder}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.titleLabel}</label>
            <input name="title" maxLength={120} placeholder={p.titlePlaceholder} className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.serviceLabel}</label>
            <select name="serviceId" defaultValue="" className={inputClass}>
              <option value="">{p.serviceNone}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.totalLabel}</label>
              <input
                name="totalPunches"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={10}
                dir="ltr"
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.priceLabel}</label>
              <input
                name="priceShekels"
                type="number"
                min={0}
                step="1"
                dir="ltr"
                placeholder={p.pricePlaceholder}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">{p.noteLabel}</label>
            <textarea name="note" rows={2} maxLength={500} className={inputClass} />
          </div>

          {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
          {state.ok ? <p className="text-sm text-green-600">{p.successAdded}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? t.common.loading : p.submitAdd}
          </button>
        </form>
      )}
    </section>
  );
}
