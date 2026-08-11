'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { createCampaignAction, type CreateCampaignState } from './actions';
import type { CampaignSegment } from '@/server/repos/marketing';

type Props = {
  /** ספירת נמענים לכל פילוח — לתצוגה מקדימה. */
  counts: Record<CampaignSegment, number>;
};

const initialState: CreateCampaignState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

const SEGMENTS: CampaignSegment[] = ['all', 'active', 'with_appointments'];

export default function CampaignForm({ counts }: Props) {
  const m = t.admin.marketingModule;
  const [state, formAction, pending] = useActionState(createCampaignAction, initialState);
  const [segment, setSegment] = useState<CampaignSegment>('all');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSegment('all');
    }
  }, [state]);

  const errorText =
    state.error === 'name'
      ? m.errorName
      : state.error === 'body'
        ? m.errorBody
        : state.error
          ? m.errorGeneric
          : null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">{m.newCampaignTitle}</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{m.nameLabel}</label>
          <input
            name="name"
            required
            maxLength={120}
            placeholder={m.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{m.bodyLabel}</label>
          <textarea
            name="body"
            required
            rows={4}
            maxLength={1000}
            placeholder={m.bodyPlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{m.segmentLabel}</label>
          <select
            name="segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value as CampaignSegment)}
            className={inputClass}
          >
            {SEGMENTS.map((seg) => (
              <option key={seg} value={seg}>
                {m.segments[seg]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-slate-500">
            {m.recipientsPreview}: <span className="font-semibold text-slate-700">{counts[segment]}</span>
          </p>
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{m.successCreated}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.common.loading : m.submitCreate}
        </button>
      </form>
    </section>
  );
}
