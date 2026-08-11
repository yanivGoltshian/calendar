'use client';

import { useActionState } from 'react';
import { BusinessType } from '@prisma/client';
import { t } from '@/i18n';
import { Card, Button } from '@/components/ui';
import { createBusinessAction, type CreateBusinessState } from './actions';

const initialState: CreateBusinessState = {};

const inputClass =
  'w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sand-900 ' +
  'placeholder:text-sand-400 shadow-sm transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/**
 * טופס הקמת עסק (אפיק D1): שם, סוג, טלפון, כתובת.
 * שדות ותוויות שאובים מ-i18n של הגדרות הפרופיל. מעל useActionState.
 */
export function CreateBusinessForm() {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);
  const p = t.admin.settings.profile;
  const types = t.admin.settings.types;

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-sand-800">
            {p.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder={p.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-sand-800">
            {p.typeLabel}
          </label>
          <select id="type" name="type" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {(Object.values(BusinessType) as BusinessType[]).map((bt) => (
              <option key={bt} value={bt}>
                {types[bt]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-sand-800">
            {p.phoneLabel}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder={p.phonePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-sand-800">
            {p.addressLabel}
          </label>
          <input
            id="address"
            name="address"
            type="text"
            placeholder={p.addressPlaceholder}
            className={inputClass}
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t.business.create.submitting : t.business.create.submit}
        </Button>
      </form>
    </Card>
  );
}

export default CreateBusinessForm;
