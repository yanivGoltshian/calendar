'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import { saveStaffAction, type SaveStaffState } from './actions';

export type StaffFormValues = {
  id: string;
  phone: string;
  name: string;
  displayName: string;
  title: string;
  bio: string;
  permissionLevel: 'CALENDAR_ONLY' | 'MANAGER';
  active: boolean;
};

type Props = {
  /** ערכים התחלתיים במצב עריכה. כשלא מועבר — מצב הוספה. */
  initial?: StaffFormValues;
};

const emptyState: SaveStaffState = { ok: false, mode: 'add' };
const editState: SaveStaffState = { ok: false, mode: 'edit' };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function StaffForm({ initial }: Props) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    saveStaffAction,
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
    state.error === 'phone'
      ? t.admin.team.errorPhone
      : state.error === 'name'
        ? t.admin.team.errorName
        : state.error === 'duplicate'
          ? t.admin.team.errorDuplicate
          : state.error
            ? t.admin.team.errorGeneric
            : null;

  const successText = state.ok
    ? state.mode === 'edit'
      ? t.admin.team.successUpdated
      : t.admin.team.successAdded
    : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1b1715]">
          {isEdit ? t.admin.team.editTitle : t.admin.team.addTitle}
        </h2>
        {isEdit ? (
          <Link
            href="/admin/team"
            className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038] hover:underline"
          >
            {t.admin.team.cancelEdit}
          </Link>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.displayNameLabel}
          </label>
          <input
            name="displayName"
            required
            defaultValue={initial?.displayName ?? ''}
            placeholder={t.admin.team.displayNamePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.phoneLabel}
          </label>
          <input
            name="phone"
            required
            type="tel"
            dir="ltr"
            defaultValue={initial?.phone ?? ''}
            placeholder={t.admin.team.phonePlaceholder}
            className={`${inputClass} text-right`}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.nameLabel}
          </label>
          <input
            name="name"
            defaultValue={initial?.name ?? ''}
            placeholder={t.admin.team.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.titleLabel}
          </label>
          <input
            name="title"
            defaultValue={initial?.title ?? ''}
            placeholder={t.admin.team.titlePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.bioLabel}
          </label>
          <textarea
            name="bio"
            rows={2}
            defaultValue={initial?.bio ?? ''}
            placeholder={t.admin.team.bioPlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {t.admin.team.permissionLabel}
          </label>
          <select
            name="permissionLevel"
            defaultValue={initial?.permissionLevel ?? 'CALENDAR_ONLY'}
            className={inputClass}
          >
            <option value="CALENDAR_ONLY">{t.admin.team.permissionCalendarOnly}</option>
            <option value="MANAGER">{t.admin.team.permissionManager}</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#4a4038]">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
          />
          {t.admin.team.activeLabel}
        </label>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isEdit ? t.admin.team.submitEdit : t.admin.team.submitAdd}
        </button>
      </form>
    </section>
  );
}
