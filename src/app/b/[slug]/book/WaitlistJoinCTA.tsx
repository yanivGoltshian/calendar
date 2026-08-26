'use client';

import { useState } from 'react';
import { t } from '@/i18n';
import { Mascot } from '@/components/brand/Mascot';

type WindowPreset = 'any' | 'morning' | 'afternoon' | 'evening';

type Props = {
  slug: string;
  serviceId?: string | null;
  staffId?: string | null;
  desiredDate?: string | null;
};

/**
 * קריאה לפעולה להצטרפות לרשימת המתנה כשאין משבצות פנויות ליום שנבחר. ידידותי
 * לאורח (ללא התחברות): שם + נייד + חלון זמן מועדף. שולח ל-/api/waitlist/join,
 * מעביר את השירות/הצוות/התאריך שנבחרו כדי שההתאמה בעת ביטול תהיה מדויקת ככל האפשר.
 */
export default function WaitlistJoinCTA({ slug, serviceId, staffId, desiredDate }: Props) {
  const j = t.waitlist.join;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [win, setWin] = useState<WindowPreset>('any');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    setError('');
    if (name.trim().length === 0) {
      setError(j.errorName);
      return;
    }
    if (phone.trim().length === 0) {
      setError(j.errorPhone);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          phone: phone.trim(),
          serviceId: serviceId ?? undefined,
          staffId: staffId ?? undefined,
          desiredDate: desiredDate ?? undefined,
          window: win,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const code = data.error;
        setError(code === 'name' ? j.errorName : code === 'phone' ? j.errorPhone : j.errorGeneric);
        return;
      }
      setDone(true);
    } catch {
      setError(j.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center">
        <div className="mb-2 flex justify-center">
          <Mascot pose="wink" className="h-14 w-14" />
        </div>
        <p className="text-lg font-semibold text-slate-900">{j.successTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{j.successBody}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Mascot pose="wink" className="hidden h-12 w-12 shrink-0 sm:block" />
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900">{j.title}</p>
          <p className="mt-1 text-sm text-slate-600">{j.subtitle}</p>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{j.nameLabel}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={j.namePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{j.phoneLabel}</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={j.phonePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{j.windowLabel}</label>
            <select
              value={win}
              onChange={(e) => setWin(e.target.value as WindowPreset)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="any">{j.windowAny}</option>
              <option value="morning">{j.windowMorning}</option>
              <option value="afternoon">{j.windowAfternoon}</option>
              <option value="evening">{j.windowEvening}</option>
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-xl bg-brand-600 py-3 text-center font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? j.submitting : j.submit}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-center font-semibold text-white transition hover:bg-brand-700"
        >
          {j.cta}
        </button>
      )}
    </div>
  );
}
