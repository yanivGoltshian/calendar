'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useAdminForm } from '@/components/useAdminForm';
import { requireSavedService } from '@/lib/adminFormState';
import type { AdminServiceSnapshot } from '@/lib/adminServiceSnapshot';
import { t } from '@/i18n';
import type { SaveServiceState } from './actions';

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

export type ServiceFormProps = {
  /** ערכים התחלתיים במצב עריכה. כשלא מועבר — מצב הוספה. */
  initial?: ServiceFormValues;
  /** אנשי צוות פעילים לבחירה כמעניקי השירות. */
  staffOptions?: { id: string; displayName: string }[];
  /** מזהי אנשי הצוות המשויכים כרגע לשירות (במצב עריכה). */
  selectedStaffIds?: string[];
  onSaved?: (service: AdminServiceSnapshot, closeEditor: boolean) => void;
};

const emptyState: SaveServiceState = { ok: false, mode: 'add' };
const editState: SaveServiceState = { ok: false, mode: 'edit' };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function ServiceForm({
  initial: initialValues,
  staffOptions = [],
  selectedStaffIds: initialStaffIds = [],
  onSaved,
}: ServiceFormProps) {
  const [initial] = useState(initialValues);
  const [selectedStaffIds] = useState(initialStaffIds);
  const isEdit = Boolean(initial);
  const active = useRef(true);
  const [hydrated, setHydrated] = useState(false);
  const {
    state,
    onSubmit,
    pending: saving,
  } = useAdminForm(
    'services',
    isEdit ? editState : emptyState,
    initial && onSaved
      ? (result) => {
          const service = requireSavedService(result, initial.id);
          onSaved(service, active.current);
        }
      : undefined,
  );
  const pending = saving;
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  useEffect(() => {
    active.current = true;
    setHydrated(true);
    return () => {
      active.current = false;
    };
  }, []);

  // איפוס הטופס לאחר הוספה מוצלחת בלבד.
  useEffect(() => {
    if (state.ok && state.mode === 'add') {
      formRef.current?.reset();
    }
  }, [state]);

  const errorText =
    state.error === 'unconfirmed'
      ? t.common.saveUnconfirmed
      : state.error === 'name'
        ? t.admin.services.errorName
        : state.error === 'duration'
          ? t.admin.services.errorDuration
          : state.error === 'price'
            ? t.admin.services.errorPrice
            : state.error === 'staff'
              ? t.admin.services.errorStaff
              : state.error
                ? t.admin.services.errorGeneric
                : null;

  const successText = state.ok
    ? state.mode === 'edit'
      ? t.admin.services.successUpdated
      : t.admin.services.successAdded
    : null;

  return (
    <section
      className={
        isEdit ? '' : 'mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm'
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id={`${formId}-title`} className="text-lg font-bold text-[#1b1715]">
          {isEdit ? t.admin.services.editTitle : t.admin.services.addTitle}
        </h2>
        {isEdit ? (
          <button
            type="button"
            disabled={pending || !hydrated}
            onClick={() => window.history.pushState(null, '', '/admin/services')}
            className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038] hover:underline disabled:opacity-60"
          >
            {t.admin.services.cancelEdit}
          </button>
        ) : null}
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        aria-labelledby={`${formId}-title`}
        aria-busy={pending}
        data-hydrated={hydrated}
        className="space-y-4"
      >
        {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

        <div>
          <label
            htmlFor={`${formId}-name`}
            className="mb-1 block text-sm font-medium text-[#4a4038]"
          >
            {t.admin.services.nameLabel}
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder={t.admin.services.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-description`}
            className="mb-1 block text-sm font-medium text-[#4a4038]"
          >
            {t.admin.services.descriptionLabel}
          </label>
          <textarea
            id={`${formId}-description`}
            name="description"
            rows={2}
            defaultValue={initial?.description ?? ''}
            placeholder={t.admin.services.descriptionPlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor={`${formId}-duration`}
              className="mb-1 block text-sm font-medium text-[#4a4038]"
            >
              {t.admin.services.durationLabel}
            </label>
            <input
              id={`${formId}-duration`}
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
            <label
              htmlFor={`${formId}-price`}
              className="mb-1 block text-sm font-medium text-[#4a4038]"
            >
              {t.admin.services.priceLabel}
            </label>
            <input
              id={`${formId}-price`}
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

        <div className="space-y-2 rounded-lg bg-[#f7f2ea] p-3">
          <label className="flex items-center gap-2 text-sm text-[#4a4038]">
            <input
              type="checkbox"
              name="hidePrice"
              defaultChecked={initial?.hidePrice ?? false}
              className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hidePriceLabel}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#4a4038]">
            <input
              type="checkbox"
              name="hideDuration"
              defaultChecked={initial?.hideDuration ?? false}
              className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hideDurationLabel}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#4a4038]">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={initial?.hidden ?? false}
              className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
            />
            {t.admin.services.hiddenLabel}
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.services.staffLinkLabel}
          </legend>
          {staffOptions.length === 0 ? (
            <p className="text-sm text-[#8f8478]">{t.admin.services.staffLinkEmpty}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#8f8478]">
                {t.admin.services.staffLinkHint}
              </p>
              <div className="space-y-2 rounded-lg bg-[#f7f2ea] p-3">
                {staffOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-[#4a4038]"
                  >
                    <input
                      type="checkbox"
                      name="staffIds"
                      value={s.id}
                      defaultChecked={
                        selectedStaffIds.includes(s.id) ||
                        (!isEdit && staffOptions.length === 1)
                      }
                      className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
                    />
                    {s.displayName}
                  </label>
                ))}
              </div>
            </>
          )}
        </fieldset>

        {errorText ? (
          <p role="alert" className="text-sm text-red-600">
            {errorText}
          </p>
        ) : null}
        {successText ? (
          <p role="status" className="text-sm text-green-600">
            {successText}
          </p>
        ) : null}

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
