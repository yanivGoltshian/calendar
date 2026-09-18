'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import {
  REVIEW_NAME_LIMIT,
  REVIEW_TEXT_LIMIT,
  type ReviewActionState,
  type ReviewSubmitAction,
} from '@/lib/businessReviews';
import RatingInput from '@/components/reviews/RatingInput';

const initial: ReviewActionState = { ok: false };
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';

export default function ReviewSubmissionForm({
  slug,
  name,
  appointments,
  action,
  onClose,
}: {
  slug: string;
  name: string;
  appointments: { id: string; label: string }[];
  action: ReviewSubmitAction;
  onClose?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const labels = t.reviews;
  if (state.ok) {
    return (
      <section
        role="status"
        className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <h2 className="text-lg font-bold">{labels.successTitle}</h2>
        <p>{labels.pendingSuccess}</p>
        {onClose ? <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center font-semibold underline">{labels.back}</button> : <Link
          href={`/b/${encodeURIComponent(slug)}#reviews`}
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          {labels.back}
        </Link>}
      </section>
    );
  }
  return (
    <form
      action={formAction}
      aria-busy={pending}
      data-hydrated={hydrated}
      className="space-y-5"
    >
      <input type="hidden" name="slug" value={slug} />
      <fieldset disabled={pending || !hydrated} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{labels.service}</span>
          <select name="appointmentId" required className={inputClass}>
            {appointments.map((appointment) => (
              <option value={appointment.id} key={appointment.id}>
                {appointment.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">
            {labels.name} · {labels.required}
          </span>
          <input
            name="name"
            defaultValue={name.slice(0, REVIEW_NAME_LIMIT)}
            maxLength={REVIEW_NAME_LIMIT}
            required
            autoComplete="name"
            className={inputClass}
          />
        </label>
        <RatingInput value={rating} onChange={setRating} />
        <label className="block space-y-1">
          <span className="text-sm font-semibold">
            {labels.text} · {labels.optional}
          </span>
          <textarea
            name="text"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={REVIEW_TEXT_LIMIT}
            className={inputClass}
          />
          <span className="block text-xs text-slate-500">
            {labels.counter.replace('{count}', String(text.length))} · {labels.textHint}
          </span>
        </label>
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed">
          {labels.beforeSubmit}
        </p>
        {state.error ? (
          <p role="alert" className="text-sm text-red-700">
            {labels.errors[state.error]}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-[#102039] px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? labels.saving : labels.submit}
        </button>
      </fieldset>
    </form>
  );
}
