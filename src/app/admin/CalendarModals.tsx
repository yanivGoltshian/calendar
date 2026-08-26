'use client';

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n';
import { formatDuration } from '@/lib/time';
import { formatAgorot } from '@/lib/money';
import {
  createManualAppointmentAction,
  setAppointmentStatusAction,
  type CreateApptState,
} from './actions';
import { serviceColor } from './serviceColors';
import type { ApptBlock, ServiceOption } from './calendar-types';

const c = t.admin.calendar;
const initialState: CreateApptState = { ok: false };

/** שכבת רקע בהירה (RTL) עם סגירה בלחיצה על הרקע וב-Esc. */
function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      dir="rtl"
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={c.close}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

/** מודל יצירת תור ידני (זמן מגיע מהגרירה וניתן לעריכה). */
export function CreateAppointmentModal({
  staffId,
  staffName,
  date,
  time,
  services,
  onClose,
}: {
  staffId: string;
  staffName: string;
  date: string;
  time: string;
  services: ServiceOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createManualAppointmentAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router]);

  const errorText =
    state.error === 'slot_taken'
      ? t.admin.form.errorSlotTaken
      : state.error
        ? t.admin.form.errorGeneric
        : null;

  return (
    <Overlay title={c.createTitle} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">{staffName}</p>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="staffId" value={staffId} />
        <input type="hidden" name="date" value={date} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.form.clientName}
          </label>
          <input name="clientName" required autoFocus className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t.admin.clients.phoneOptionalLabel}
          </label>
          <input
            name="clientPhone"
            inputMode="tel"
            dir="ltr"
            placeholder={t.auth.phonePlaceholder}
            className={inputClass}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.form.service}
            </label>
            <select name="serviceId" required className={`${inputClass} bg-white`}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)} ·{' '}
                  {formatAgorot(s.priceAgorot)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.admin.form.time}
            </label>
            <input
              name="time"
              type="time"
              required
              dir="ltr"
              defaultValue={time}
              className={inputClass}
            />
          </div>
        </div>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? c.creating : t.admin.form.submit}
        </button>
      </form>
    </Overlay>
  );
}

type StatusTarget = { status: string; label: string; tone: string };

const STATUS_TARGETS: readonly StatusTarget[] = [
  { status: 'CONFIRMED', label: c.markConfirmed, tone: 'text-brand-700 ring-brand-200 hover:bg-brand-50' },
  { status: 'ARRIVED', label: c.markArrived, tone: 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50' },
  { status: 'DONE', label: c.markDone, tone: 'text-slate-700 ring-slate-200 hover:bg-slate-50' },
  { status: 'NO_SHOW', label: c.markNoShow, tone: 'text-amber-700 ring-amber-200 hover:bg-amber-50' },
  { status: 'CANCELLED', label: c.markCancelled, tone: 'text-red-700 ring-red-200 hover:bg-red-50' },
  { status: 'PENDING', label: c.reopen, tone: 'text-slate-600 ring-slate-200 hover:bg-slate-50' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-brand-100 text-brand-700',
  ARRIVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-amber-100 text-amber-700',
  DONE: 'bg-slate-200 text-slate-800',
};

const STATUS_LABELS = t.admin.statuses as Record<string, string>;

/** מודל פרטי תור + שינוי סטטוס. */
export function AppointmentDetailModal({
  appt,
  onClose,
}: {
  appt: ApptBlock;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(appt.status);
  const color = serviceColor(appt.colorIndex);

  function changeStatus(next: string) {
    startTransition(async () => {
      const res = await setAppointmentStatusAction(appt.id, next);
      if (res.ok) {
        setStatus(next);
        router.refresh();
      }
    });
  }

  return (
    <Overlay title={c.detailsTitle} onClose={onClose}>
      <div
        className="mb-4 rounded-xl border-r-4 bg-slate-50 p-4"
        style={{ borderColor: color.border }}
      >
        <p className="text-lg font-semibold text-slate-900">
          {appt.clientName || c.untitledClient}
        </p>
        {appt.verificationStatus === 'UNVERIFIED' ||
        appt.verificationStatus === 'NONE' ? (
          <span className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
            {appt.verificationStatus === 'NONE'
              ? t.admin.verification.badgeNone
              : t.admin.verification.badgeUnverified}
          </span>
        ) : null}
        {appt.clientPhone ? (
          <p dir="ltr" className="text-left text-sm text-slate-500">
            {appt.clientPhone}
          </p>
        ) : null}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">{t.admin.form.time}</dt>
          <dd dir="ltr" className="font-medium text-slate-900">
            {appt.startLabel}–{appt.endLabel}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">{c.durationLabel}</dt>
          <dd className="font-medium text-slate-900">
            {formatDuration(appt.durationMin)}
          </dd>
        </div>
        {appt.serviceNames ? (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{t.admin.form.service}</dt>
            <dd className="text-left font-medium text-slate-900">
              {appt.serviceNames}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-slate-500">{c.priceLabel}</dt>
          <dd className="font-medium text-slate-900">
            {formatAgorot(appt.priceAgorot)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">{t.admin.status}</dt>
          <dd>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-medium text-slate-700">{c.changeStatus}</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_TARGETS.filter((s) => s.status !== status).map((s) => (
            <button
              key={s.status}
              type="button"
              disabled={pending}
              onClick={() => changeStatus(s.status)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 transition disabled:opacity-50 ${s.tone}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
