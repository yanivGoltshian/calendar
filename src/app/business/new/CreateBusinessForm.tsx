'use client';

import { useActionState, useState } from 'react';
import { BusinessType } from '@prisma/client';
import { t } from '@/i18n';
import { Card, Button } from '@/components/ui';
import { createBusinessAction, type CreateBusinessState } from './actions';

const initialState: CreateBusinessState = {};

const inputClass =
  'w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sand-900 ' +
  'placeholder:text-sand-400 shadow-sm transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/** אימוג׳י מייצג לכל תחום עסק, להצגה על אריחי הבחירה. */
const TYPE_ICONS: Record<BusinessType, string> = {
  BARBERSHOP: '💈',
  HAIR_SALON: '💇',
  NAILS: '💅',
  BEAUTY_COSMETICS: '💄',
  SPA_MASSAGE: '💆',
  BROWS_LASHES: '✨',
  TATTOO_PIERCING: '🖋️',
  CLINIC: '🩺',
  FITNESS: '💪',
  OTHER: '🏪',
};

/**
 * צעד 1 בבניית העסק: מסך מינימלי אחד — שם העסק + בחירת תחום כאריחי הקשה.
 * טלפון/כתובת/שאלות שיווק נדחים לשלב מאוחר יותר (לא חובה כאן).
 * ה-CTA נפתח ברגע שנבחר תחום; שליחה ממשיכה לאשף ההקמה המודרך.
 */
export function CreateBusinessForm() {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);
  const [selectedType, setSelectedType] = useState<BusinessType | ''>('');
  const c = t.business.create;
  const f = c.fields;
  const types = t.admin.settings.types;

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <Card>
        <form action={formAction} className="space-y-6">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-sand-800">
              {f.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              placeholder={f.namePlaceholder}
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-sand-800">
              {c.chooseTypeLabel}
            </legend>
            {/* אריחי הקשה לבחירת תחום — נגישים כקבוצת כפתורים עם aria-pressed */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.values(BusinessType) as BusinessType[]).map((bt) => {
                const active = selectedType === bt;
                return (
                  <button
                    key={bt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedType(bt)}
                    className={
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ' +
                      'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' +
                      (active
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                        : 'border-sand-200 bg-white hover:border-brand-300 hover:bg-sand-50')
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        'flex h-10 w-10 items-center justify-center rounded-xl text-xl ' +
                        (active ? 'bg-brand-100' : 'bg-sand-100')
                      }
                    >
                      {TYPE_ICONS[bt]}
                    </span>
                    <span className="text-xs font-semibold leading-tight text-sand-800">
                      {types[bt]}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* הערך הנבחר נשלח לשרת דרך שדה מוסתר, כמו קלט טופס רגיל */}
            <input type="hidden" name="type" value={selectedType} />
          </fieldset>

          <p className="text-xs text-sand-500">{c.deferNote}</p>

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <Button type="submit" disabled={pending || !selectedType} className="w-full">
            {pending ? c.submitting : c.submit}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default CreateBusinessForm;
