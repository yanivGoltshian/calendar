'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import { saveProductAction, type SaveProductState } from './actions';

export type ProductFormValues = {
  id: string;
  name: string;
  sku: string;
  price: string;
  category: string;
  active: boolean;
};

type Props = {
  /** ערכים התחלתיים במצב עריכה. כשלא מועבר — מצב הוספה. */
  initial?: ProductFormValues;
};

const emptyState: SaveProductState = { ok: false, mode: 'add' };
const editState: SaveProductState = { ok: false, mode: 'edit' };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function ProductForm({ initial }: Props) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    saveProductAction,
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
      ? t.admin.pos.products.errorName
      : state.error === 'price'
        ? t.admin.pos.products.errorPrice
        : state.error
          ? t.admin.pos.products.errorGeneric
          : null;

  const successText = state.ok
    ? state.mode === 'edit'
      ? t.admin.pos.products.successUpdated
      : t.admin.pos.products.successAdded
    : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1b1715]">
          {isEdit ? t.admin.pos.products.editTitle : t.admin.pos.products.addTitle}
        </h2>
        {isEdit ? (
          <Link href="/admin/pos/products" className="text-sm text-brand-700 hover:underline">
            {t.admin.pos.products.cancelEdit}
          </Link>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.pos.products.nameLabel}
          </label>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder={t.admin.pos.products.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.products.skuLabel}
            </label>
            <input
              name="sku"
              dir="ltr"
              defaultValue={initial?.sku ?? ''}
              placeholder={t.admin.pos.products.skuPlaceholder}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.products.priceLabel}
            </label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              dir="ltr"
              defaultValue={initial?.price ?? ''}
              placeholder={t.admin.pos.products.pricePlaceholder}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.pos.products.categoryLabel}
          </label>
          <input
            name="category"
            defaultValue={initial?.category ?? ''}
            placeholder={t.admin.pos.products.categoryPlaceholder}
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[#4a4038]">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial ? initial.active : true}
            className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
          />
          {t.admin.pos.products.activeLabel}
        </label>

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
              ? t.admin.pos.products.submitEdit
              : t.admin.pos.products.submitAdd}
        </button>
      </form>
    </section>
  );
}
