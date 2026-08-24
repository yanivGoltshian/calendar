'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import {
  saveStockMovementAction,
  saveThresholdAction,
  type StockMovementState,
} from './actions';

/** נתוני המוצר הנערך (מגיע מ-getStockRow בעמוד השרת). */
export type StockFormProduct = {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
  tracked: boolean;
};

type Props = { product: StockFormProduct };

type Mode = 'count' | 'purchase' | 'adjustment' | 'return';

const initialState: StockMovementState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function StockForm({ product }: Props) {
  const [state, formAction, pending] = useActionState(saveStockMovementAction, initialState);
  const [mode, setMode] = useState<Mode>('count');
  const formRef = useRef<HTMLFormElement>(null);

  // איפוס טופס התנועה לאחר עדכון מוצלח.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const hint =
    mode === 'count'
      ? t.admin.inventory.countHint
      : mode === 'purchase'
        ? t.admin.inventory.purchaseHint
        : mode === 'return'
          ? t.admin.inventory.returnHint
          : t.admin.inventory.adjustmentHint;

  const errorText =
    state.error === 'amount'
      ? t.admin.inventory.errorAmount
      : state.error === 'product'
        ? t.admin.inventory.errorProduct
        : state.error
          ? t.admin.inventory.errorGeneric
          : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1b1715]">{t.admin.inventory.panelTitle}</h2>
        <Link href="/admin/inventory" className="text-sm text-brand-700 hover:underline">
          {t.common.close}
        </Link>
      </div>

      <p className="mb-4 text-sm text-[#6e655f]">
        {t.admin.inventory.productLabel}:{' '}
        <span className="font-medium text-[#1b1715]">{product.name}</span>
        {' · '}
        {t.admin.inventory.currentQuantityLabel}:{' '}
        <span className="font-medium text-[#1b1715]">
          {product.tracked ? product.quantity : t.admin.inventory.quantityUntracked}
        </span>
      </p>

      {/* טופס תנועת מלאי (עם מצב) */}
      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="productId" value={product.id} />

        <div>
          <label htmlFor="stock-mode" className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.inventory.modeLabel}
          </label>
          <select
            id="stock-mode"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className={inputClass}
          >
            <option value="count">{t.admin.inventory.modeCount}</option>
            <option value="purchase">{t.admin.inventory.modePurchase}</option>
            <option value="adjustment">{t.admin.inventory.modeAdjustment}</option>
            <option value="return">{t.admin.inventory.modeReturn}</option>
          </select>
          <p className="mt-1 text-xs text-[#8f8478]">{hint}</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="stock-amount" className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.inventory.amountLabel}
            </label>
            <input
              id="stock-amount"
              name="amount"
              type="number"
              step="1"
              required
              dir="ltr"
              placeholder={t.admin.inventory.amountPlaceholder}
              className={inputClass}
            />
          </div>
          {mode === 'purchase' ? (
            <div className="flex-1">
              <label htmlFor="stock-unit-cost" className="mb-1 block text-sm font-medium text-[#4a4038]">
                {t.admin.inventory.unitCostLabel}
              </label>
              <input
                id="stock-unit-cost"
                name="unitCost"
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                placeholder={t.admin.inventory.unitCostPlaceholder}
                className={inputClass}
              />
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="stock-note" className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.inventory.noteLabel}
          </label>
          <input
            id="stock-note"
            name="note"
            placeholder={t.admin.inventory.notePlaceholder}
            className={inputClass}
          />
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{t.admin.inventory.successMovement}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.common.loading : t.admin.inventory.submitMovement}
        </button>
      </form>

      {/* טופס סף התראת מלאי נמוך — נפרד, ללא מצב */}
      <form action={saveThresholdAction} className="mt-6 border-t border-[#e7ddcd] pt-4">
        <input type="hidden" name="productId" value={product.id} />
        <label htmlFor="stock-threshold" className="mb-1 block text-sm font-medium text-[#4a4038]">
          {t.admin.inventory.thresholdInputLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="stock-threshold"
            name="threshold"
            type="number"
            min={0}
            step="1"
            dir="ltr"
            defaultValue={product.threshold > 0 ? String(product.threshold) : ''}
            placeholder={t.admin.inventory.thresholdInputHint}
            className={inputClass}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {t.admin.inventory.submitThreshold}
          </button>
        </div>
        <p className="mt-1 text-xs text-[#8f8478]">{t.admin.inventory.thresholdInputHint}</p>
      </form>
    </section>
  );
}
