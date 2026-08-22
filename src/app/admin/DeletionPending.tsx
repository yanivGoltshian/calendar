'use client';

import { useActionState } from 'react';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { Mascot } from '@/components/brand/Mascot';
import {
  ownerLogout,
  restoreAccountAction,
  type RestoreState,
} from './actions';

const initialState: RestoreState = { ok: false };

/**
 * מסך "המנוי מסומן למחיקה": מוצג במקום אזור הניהול כל עוד העסק ב-PENDING_DELETION.
 * הבעלים עדיין מזוהה (נדרש לצורך השחזור), אך התוכן הרגיל חסום ומוחלף במסך זה.
 * מאפשר שתי פעולות בלבד: שחזור המנוי (הזנת טלפון העסק) או התנתקות.
 */
export default function DeletionPending({
  businessName,
  purgeDateLabel,
}: {
  businessName: string;
  purgeDateLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    restoreAccountAction,
    initialState,
  );
  const c = t.admin.deletionPending;

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"
    >
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <Mascot pose="head" size={30} className="drop-shadow-sm" />
          <p className="text-lg font-bold text-slate-900">{BRAND.name}</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h1 className="text-xl font-bold text-red-800">{c.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-red-900">{c.intro}</p>
          <p className="mt-3 text-sm font-semibold text-red-900">
            {c.purgePrefix}
          </p>
          <p className="mt-1 text-base font-bold text-red-900">
            {purgeDateLabel}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-sm text-slate-600">
            {businessName}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {c.restoreHint}
          </p>

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
              {c.phoneLabel}
              <input
                type="tel"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder={c.phonePlaceholder}
                className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>

            {state.error ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {c.restoreError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? c.restoring : c.restoreButton}
            </button>
          </form>
        </div>

        <form action={ownerLogout} className="mt-4">
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {c.logout}
          </button>
        </form>
      </div>
    </main>
  );
}
