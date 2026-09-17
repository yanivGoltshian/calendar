'use client';

import { useId } from 'react';
import { t } from '@/i18n';

export default function RatingInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">
        {t.reviews.rating} · {t.reviews.required}
      </legend>
      <div className="flex gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label
            key={rating}
            htmlFor={`${id}-${rating}`}
            className="relative cursor-pointer"
          >
            <input
              id={`${id}-${rating}`}
              type="radio"
              name="rating"
              value={rating}
              required
              checked={value === rating}
              onChange={() => onChange(rating)}
              aria-label={t.reviews.starOption.replace('{rating}', String(rating))}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex h-11 w-11 items-center justify-center rounded-lg border text-3xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${rating <= value ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-300'}`}
            >
              ★
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
