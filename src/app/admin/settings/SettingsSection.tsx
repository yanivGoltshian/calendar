'use client';

import { useActionState, type ReactNode } from 'react';
import { t } from '@/i18n';
import type { SaveState } from './actions';

const initialSaveState: SaveState = { ok: false };

type Props = {
  title: string;
  description?: string;
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  children: ReactNode;
};

/**
 * עטיפת סעיף בעמוד ההגדרות: כותרת, טופס עם שדות (children),
 * הודעות שגיאה/הצלחה וכפתור שמירה — מעל useActionState.
 */
export default function SettingsSection({ title, description, action, children }: Props) {
  const [state, formAction, pending] = useActionState(action, initialSaveState);

  const errorText =
    state.error === 'name'
      ? t.admin.settings.profile.errorName
      : state.error === 'number'
        ? t.admin.settings.policy.errorNumber
        : state.error
          ? t.admin.settings.errorGeneric
          : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>

      <form action={formAction} className="space-y-4">
        {children}

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{t.admin.settings.saved}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.admin.settings.saving : t.admin.settings.save}
        </button>
      </form>
    </section>
  );
}
