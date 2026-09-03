'use client';

import { useState } from 'react';
import { t } from '@/i18n';

type Props = {
  slug: string;
  // התאריך (YYYY-MM-DD מקומי) שאליו הלקוח מבקש להיכנס לרשימת ההמתנה.
  date: string;
  // מזהי השירותים שנבחרו במסלול ההזמנה. WaitlistEntry שומר שירות יחיד — נשתמש בראשון.
  serviceIds: string[];
  staffId?: string | null;
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  // 'full' — יום ללא זמינות כלל (ברירת מחדל). 'partial' — יש מועדים אך לא בשעה המבוקשת.
  variant?: 'full' | 'partial';
};

/** בדיקת פורמט אימייל קלה בצד לקוח (השרת מאמת שוב עם zod). */
function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** המרת "HH:MM" למספר דקות מחצות (0–1439). מחזיר undefined אם הקלט ריק/לא תקין. */
function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * CTA ברמת-היום לרשימת המתנה, מוצג בעמוד ההזמנה כשאין מועדים פנויים ליום שנבחר.
 * מצב סגור: כותרת + הסבר קצר + כפתור. בלחיצה נפתח טופס אורח (שם + נייד + חלון זמן מועדף)
 * ששולח ל-/api/waitlist/join. מובייל-first, RTL. מנהל מצב טעינה/שגיאה/הצלחה עצמאי.
 */
export default function WaitlistJoinCTA({
  slug,
  date,
  serviceIds,
  staffId,
  defaultName,
  defaultPhone,
  defaultEmail,
  variant = 'full',
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const w = t.booking.waitlist;
  const heading = variant === 'partial' ? w.partialTitle : w.title;
  const subtitle = variant === 'partial' ? w.partialSubtitle : w.subtitle;
  const ctaLabel = variant === 'partial' ? w.partialCta : w.cta;

  async function submit() {
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError(w.errorMissing);
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !isLikelyEmail(trimmedEmail)) {
      setError(w.errorEmail);
      return;
    }
    setBusy(true);
    try {
      const earliestMinute = timeToMinutes(fromTime);
      const latestMinute = timeToMinutes(toTime);
      const body: Record<string, unknown> = {
        slug,
        name: name.trim(),
        phone: phone.trim(),
        desiredDate: date,
      };
      if (trimmedEmail) body.email = trimmedEmail;
      if (serviceIds[0]) body.serviceId = serviceIds[0];
      if (staffId) body.staffId = staffId;
      if (earliestMinute != null) body.earliestMinute = earliestMinute;
      if (latestMinute != null) body.latestMinute = latestMinute;

      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 429) {
          setError(typeof data.message === 'string' ? data.message : w.rateLimited);
        } else if (res.status >= 500) {
          setError(w.errorGeneric);
        } else if (data.error === 'invalid_phone') {
          setError(w.errorPhone);
        } else if (data.error === 'bad_request') {
          setError(w.errorMissing);
        } else {
          setError(w.errorGeneric);
        }
        return;
      }
      setDone(true);
    } catch {
      setError(w.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h3 className="text-lg font-bold text-emerald-900">{w.successTitle}</h3>
        <p className="mt-1 text-sm leading-relaxed text-emerald-800">{w.successBody}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{heading}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-600">{subtitle}</p>

      {open ? (
        <div className="mt-5 space-y-3 text-right">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{w.nameLabel}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={w.namePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{w.phoneLabel}</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={w.phonePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{w.emailLabel}</label>
            <input
              type="email"
              dir="ltr"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={w.emailPlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-slate-400">{w.emailHint}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{w.windowLabel}</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{w.windowFrom}</span>
              <input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              />
              <span className="text-sm text-slate-500">{w.windowTo}</span>
              <input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{w.windowHint}</p>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? w.submitting : w.submit}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {w.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-base font-bold text-white transition hover:bg-brand-700"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
