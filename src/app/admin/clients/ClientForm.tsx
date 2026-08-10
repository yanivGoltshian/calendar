'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import { saveClientAction, type SaveClientState } from './actions';

export type ClientFormValues = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type Props = {
  /** ערכים התחלתיים במצב עריכה. כשלא מועבר — מצב הוספה. */
  initial?: ClientFormValues;
};

const emptyState: SaveClientState = { ok: false, mode: 'add' };
const editState: SaveClientState = { ok: false, mode: 'edit' };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function ClientForm({ initial }: Props) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    saveClientAction,
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
      ? t.admin.clients.errorName
      : state.error === 'phone'
        ? t.admin.clients.errorPhone
        : state.error === 'duplicate_phone'
          ? t.admin.clients.errorDuplicatePhone
          : state.error
            ? t.admin.clients.errorGeneric
            : null;

  const successText = state.ok
    ? state.mode === 'edit'
      ? t.admin.clients.successUpdated
      : t.admin.clients.successAdded
    : null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          {isEdit ? t.admin.clients.editTitle : t.admin.clients.addTitle}
        </h2>
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.clients.nameLabel}
          </label>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder={t.admin.clients.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.clients.phoneLabel}
            </label>
            <input
              name="phone"
              type="tel"
              required
              dir="ltr"
              defaultValue={initial?.phone ?? ''}
              placeholder={t.admin.clients.phonePlaceholder}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.clients.emailLabel}
            </label>
            <input
              name="email"
              type="email"
              dir="ltr"
              defaultValue={initial?.email ?? ''}
              placeholder={t.admin.clients.emailPlaceholder}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.clients.notesLabel}
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ''}
            placeholder={t.admin.clients.notesPlaceholder}
            className={inputClass}
          />
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
              ? t.admin.clients.submitEdit
              : t.admin.clients.submitAdd}
        </button>
      </form>
    </section>
  );
}
