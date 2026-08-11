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
 * טופס "קצת על העסק שלך" (אפיק D1 + D2), בדומה למסך שאחרי האימות ב-calmark:
 * שם עסק, סוג, טלפון, כתובת, ושתי שאלות שיווק (יומן קודם, איך שמעת עלינו).
 * כל התוויות דרך i18n; שליחה ממשיכה לאשף ההקמה (שעות/שירות/מיתוג).
 */
export function CreateBusinessForm() {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);
  const c = t.business.create;
  const f = c.fields;
  const types = t.admin.settings.types;
  const priorCalendarOptions = c.priorCalendarOptions;
  const referralOptions = c.referralOptions;

  return (
    <Card>
      {/* פס התקדמות עדין (דקורטיבי) בתחושת האונבורדינג של calmark */}
      <div className="mb-6">
        <div className="mb-2 text-xs font-medium text-brand-700">{c.progressLabel}</div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-sand-200"
          role="presentation"
          aria-hidden="true"
        >
          <div className="h-full w-2/5 rounded-full bg-brand-500" />
        </div>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder={f.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.typeLabel}
          </label>
          <select id="type" name="type" defaultValue="" className={inputClass}>
            <option value="">{f.typePlaceholder}</option>
            {(Object.values(BusinessType) as BusinessType[]).map((bt) => (
              <option key={bt} value={bt}>
                {types[bt]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.phoneLabel}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder={f.phonePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.addressLabel}
          </label>
          <input
            id="address"
            name="address"
            type="text"
            placeholder={f.addressPlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="priorCalendar" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.priorCalendarLabel}
          </label>
          <select id="priorCalendar" name="priorCalendar" defaultValue="" className={inputClass}>
            <option value="">{f.selectPlaceholder}</option>
            {(Object.keys(priorCalendarOptions) as Array<keyof typeof priorCalendarOptions>).map(
              (key) => (
                <option key={key} value={key}>
                  {priorCalendarOptions[key]}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="referralSource" className="mb-1.5 block text-sm font-medium text-sand-800">
            {f.referralLabel}
          </label>
          <select id="referralSource" name="referralSource" defaultValue="" className={inputClass}>
            <option value="">{f.selectPlaceholder}</option>
            {(Object.keys(referralOptions) as Array<keyof typeof referralOptions>).map((key) => (
              <option key={key} value={key}>
                {referralOptions[key]}
              </option>
            ))}
          </select>
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? c.submitting : c.submit}
        </Button>
      </form>
    </Card>
  );
}

export default CreateBusinessForm;
