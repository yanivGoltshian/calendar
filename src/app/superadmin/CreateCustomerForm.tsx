'use client';

import { useActionState, useState } from 'react';
import { BusinessType } from '@prisma/client';
import { t } from '@/i18n';
import { provisionBusinessAction } from './actions';

const inputClass = 'mt-1 w-full min-h-[44px] rounded-lg border border-[#16233A] bg-[#08101C] px-3 py-2 text-[#E8ECF3]';

export default function CreateCustomerForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(provisionBusinessAction, {});
  const text = t.billing.superadmin.create;
  return (
    <section className="mb-8">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="new-customer-form"
        className="min-h-[44px] rounded-xl bg-[#F2D695] px-5 py-3 font-bold text-[#08101C]">
        {text.title}
      </button>
      {open && (
        <form id="new-customer-form" action={action}
          className="mt-4 max-w-xl space-y-4 rounded-2xl border border-[#16233A] bg-[#0F1B30] p-5">
          <p className="text-sm text-[#9AA7BD]">{text.description}</p>
          <label className="block text-sm">{text.name}
            <input name="name" required maxLength={120} className={inputClass} />
          </label>
          <div className="text-sm">
            <label htmlFor="new-customer-type">{text.type}</label>
            <select id="new-customer-type" name="type" required defaultValue="" className={inputClass}>
              <option value="" disabled>{text.chooseType}</option>
              {Object.values(BusinessType).map((type) => <option key={type} value={type}>{t.admin.settings.types[type]}</option>)}
            </select>
          </div>
          <label className="block text-sm">{text.phone}
            <input name="phone" type="tel" dir="ltr" maxLength={30} autoComplete="off" className={inputClass} />
          </label>
          <label className="block text-sm">{text.email}
            <input name="email" type="email" dir="ltr" maxLength={254} autoComplete="off" className={inputClass} />
          </label>
          {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="min-h-[44px] rounded-xl bg-[#F2D695] px-5 py-3 font-bold text-[#08101C] disabled:opacity-50">
            {pending ? text.submitting : text.submit}
          </button>
        </form>
      )}
    </section>
  );
}
