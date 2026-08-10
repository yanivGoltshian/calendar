'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import { saveServiceAction, type SaveServiceState } from './actions';

export type ServiceFormValues = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceShekels: number;
  hidePrice: boolean;
  hideDuration: boolean;
  hidden: boolean;
};

type Props = {
  /** ערכים התחלתיים במצב עריכה. כשלא מועבר — מצב הוספה. */
  initial?: ServiceFormValues;
};

const emptyState: SaveServiceState = { ok: false, mode: 'add' };
const editState: SaveServiceState = { ok: false, mode: 'edit' };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function ServiceForm({ initial }: Props) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    saveServiceAction,
    isEdit ? editState : emptyState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // איפוס הטופס לאחר הוספה מוצלחת בלבד.
  useEffect(() => {
    if (state.ok && state.mode === 'add') {
      formRef.current?.reset();
    }
  }, [state]);

  const errorText =
    state.error === 'name'
      ? t.admin.services.errorName
      : state.error === 'duration'
        ? t.admin.services.errorDuration
        : state.error === 'price'
          ? t.admin.services.errorPrice
          : state.error
            ? t.admin.services.errorGeneric
            : null;

  const successText = state.ok
    ? state.mode === 'edit'
      ? t.admin.services.successUpdated
      : t.admin.services.successAdded
    : null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          {isEdit ? t.admin.services.editTitle : t.admin.services.addTitle}
        </h2>
        {isEdit ? (
          <Link
            href="/admin/services"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
          >
            {t.admin.services.cancelEdit}
          </Link>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.services.nameLabel}
          </label>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder={t.admin.services.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.services.descriptionLabel}
          </label>
          <textarea
            name="description"
            rows={2}
            defaultValue={initial?.description ?? ''}
            placeholder={t.admin.services.descriptionPlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.services.durationLabel}
            </label>
            <input
              name="durationMin"
              type="number"
              min={1}
              step={1}
              required
              dir="ltr"
              defaultValue={initial?.durationMin ?? ''}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.services.priceLabel}
            </label>
            <input
              name="priceShekels"
              type="number"
              min={0}
              step="0.01"
              required
              dir="ltr"
              defaultValue={initial?.priceShekels ?? ''}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="hidePrice"
              defaultChecked={initial?.hidePrice ?? false}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hidePriceLabel}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="hideDuration"
              defaultChecked={initial?.hideDuration ?? false}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hideDurationLabel}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={initial?.hidden ?? false}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hiddenLabel}
          </label>
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending
            ? t.common.loading
            : isEdit
              ? t.admin.services.submitEdit
              : t.admin.services.submitAdd}
        </button>
      </form>
    </section>
  );
}
