'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import { Mascot } from '@/components/brand/Mascot';
import CustomerGoogleSignIn from '@/components/auth/CustomerGoogleSignIn';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatLongDate, todayDateString, addDaysToDateString } from '@/lib/time';

type Service = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
  hidePrice: boolean;
  hideDuration: boolean;
};
type Staff = { id: string; displayName: string; title: string | null };
type Slot = { label: string; startAtUtc: string; endAtUtc: string };

type Props = {
  slug: string;
  businessName: string;
  services: Service[];
  staff: Staff[];
  preselectedServiceId?: string | null;
  // קישור עמוק מלא מהווידג'ט: איש צוות, תאריך ושעה שנבחרו (מאומתים בצד השרת של העמוד).
  preselectedStaffId?: string | null;
  preselectedDate?: string | null;
  preselectedTime?: string | null;
  plan: 'basic' | 'premium' | 'exclusive';
  // לקוח מחובר (עוגיית client_session): מאפשר מילוי מוקדם והסתרת שדה המייל.
  customer?: { name: string; phone: string; email: string } | null;
  // האם כניסת גוגל זמינה בסביבה (GOOGLE_CLIENT_ID/SECRET מוגדרים).
  googleEnabled?: boolean;
};

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_KEYS = ['services', 'staff', 'date', 'time', 'summary', 'confirm'] as const;

export default function BookingStepper({
  slug,
  businessName,
  services,
  staff,
  preselectedServiceId,
  preselectedStaffId,
  preselectedDate,
  preselectedTime,
  plan,
  customer = null,
  googleEnabled = false,
}: Props) {
  const singleStaff = staff.length === 1;
  // קישור עמוק משירות: מתחילים עם השירות מסומן ומדלגים על שלב בחירת השירותים; עם נותן שירות יחיד מדלגים גם על שלב הצוות.
  const hasPreselected = !!preselectedServiceId && services.some((s) => s.id === preselectedServiceId);
  // קישור עמוק מלא: שירות + איש צוות + תאריך + שעה תקינים → נטען זמינות ונקפוץ לסיכום.
  const dlStaffId =
    preselectedStaffId && staff.some((m) => m.id === preselectedStaffId) ? preselectedStaffId : null;
  const deepLink = hasPreselected && !!dlStaffId && !!preselectedDate && !!preselectedTime;
  const [step, setStep] = useState<Step>(
    deepLink ? 3 : hasPreselected ? (singleStaff ? 2 : 1) : 0,
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    hasPreselected ? [preselectedServiceId as string] : [],
  );
  const [staffId, setStaffId] = useState<string>(
    dlStaffId ?? (singleStaff ? staff[0].id : ''),
  );
  const [date, setDate] = useState<string>(deepLink ? (preselectedDate as string) : todayDateString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(deepLink);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // מילוי מוקדם מקישור עמוק: בטעינה, טוענים זמינות אמיתית ליום שנבחר ומדלגים לסיכום אם השעה עדיין פנויה.
  const deepLinkInit = useRef(false);
  useEffect(() => {
    if (deepLinkInit.current) return;
    deepLinkInit.current = true;
    if (!deepLink) return;
    fetch('/api/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug,
        staffId: dlStaffId,
        serviceIds: [preselectedServiceId as string],
        date: preselectedDate,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const list: Slot[] = d?.ok ? d.slots : [];
        setSlots(list);
        const match = list.find((s) => s.label === preselectedTime);
        if (match) {
          setSelectedSlot(match);
          setStep(4);
        } else {
          setStep(3);
        }
      })
      .catch(() => {
        setSlots([]);
        setStep(3);
      })
      .finally(() => setSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // מצב אישור הזמנת אורח (ללא OTP). מדיניות פרטי הקשר נגזרת ממסלול העסק:
  // בכל המסלולים שם וטלפון חובה. מייל נדרש רק בפרימיום/אקסקלוסיב (לאישור, תזכורות
  // והרשמת לקוח); בסטנדרט שדה המייל מוסתר כי אין תקשורת ללקוח הקצה.
  const requireEmail = plan === 'premium' || plan === 'exclusive';
  // לקוח מחובר: פרטי הקשר ממולאים מראש ושדה המייל מוסתר (מוגש בשקט).
  const authed = !!customer;
  const authedEmail = customer?.email?.trim() ?? '';
  const hideEmailField = authed && authedEmail.length > 0;
  const showEmailField = requireEmail && !hideEmailField;
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [name, setName] = useState(customer?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [bookedStatus, setBookedStatus] = useState<'PENDING' | 'CONFIRMED'>('CONFIRMED');

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.priceAgorot, 0);
  const selectedStaff = staff.find((m) => m.id === staffId) ?? null;

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function loadSlots(targetDate: string) {
    setSlotsLoading(true);
    setError('');
    setSelectedSlot(null);
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, staffId, serviceIds: selectedServiceIds, date: targetDate }),
      });
      const data = await res.json();
      setSlots(res.ok && data.ok ? data.slots : []);
    } catch {
      setSlots([]);
      setError(t.common.error);
    } finally {
      setSlotsLoading(false);
    }
  }

  function goToTime() {
    setStep(3);
    void loadSlots(date);
  }

  function changeDate(next: string) {
    setDate(next);
    void loadSlots(next);
  }

  async function submitBooking() {
    setBusy(true);
    setError('');
    try {
      const bookRes = await fetch('/api/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          staffId,
          serviceIds: selectedServiceIds,
          startAtUtc: selectedSlot?.startAtUtc,
          name,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const bookData = await bookRes.json();
      if (!bookRes.ok || !bookData.ok) {
        if (bookRes.status === 429) {
          setError(typeof bookData.message === 'string' ? bookData.message : t.auth.tooManyRequests);
          return;
        }
        if (bookRes.status >= 500) {
          setError(t.common.error);
          return;
        }
        const code = bookData.error;
        setError(
          code === 'slot_taken'
            ? t.booking.slotTaken
            : code === 'too_early'
              ? t.booking.tooEarly
              : code === 'too_far'
                ? t.booking.tooFar
                : code === 'invalid_phone'
                  ? t.auth.invalidPhone
                  : code === 'invalid_email'
                    ? t.auth.invalidEmail
                    : code === 'phone_required'
                      ? t.booking.phoneRequired
                      : code === 'email_required'
                        ? t.booking.emailRequired
                        : code === 'bad_request'
                          ? t.booking.guestMissingFields
                          : t.common.error,
        );
        return;
      }
      setConfirmedId(bookData.appointmentId);
      setBookedStatus(bookData.status === 'PENDING' ? 'PENDING' : 'CONFIRMED');
    } catch {
      setError(t.common.error);
    } finally {
      setBusy(false);
    }
  }

  // ----- מסך הצלחה -----
  if (confirmedId) {
    const isPending = bookedStatus === 'PENDING';
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        {isPending ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-600">
            ⏳
          </div>
        ) : (
          <Mascot
            pose="wink"
            circle
            size={72}
            alt={t.brand.success.bookingAlt}
            className="bg-green-50 ring-4 ring-green-100"
          />
        )}
        <h1 className="text-2xl font-bold text-slate-900">
          {isPending ? t.booking.pendingTitle : t.booking.bookingSuccessTitle}
        </h1>
        <p className="text-slate-600">
          {isPending ? t.booking.pendingBody : (requireEmail ? t.booking.bookingSuccessBody : t.booking.bookingSuccessBodyNoComms)}
        </p>
        <Link
          href={`/b/${slug}`}
          className="mt-4 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          {t.common.back}
        </Link>
      </div>
    );
  }

  const canProceed: Record<Step, boolean> = {
    0: selectedServiceIds.length > 0,
    1: !!staffId,
    2: !!date,
    3: !!selectedSlot,
    4: true,
    5: false,
  };

  // דילוג על שלב הצוות כאשר יש נותן שירות יחיד: המספור והמחוון נגזרים מהשלבים הגלויים בלבד.
  const visibleStepKeys: readonly (typeof STEP_KEYS)[number][] = singleStaff
    ? STEP_KEYS.filter((k) => k !== 'staff')
    : STEP_KEYS;
  const displayIndex = visibleStepKeys.indexOf(STEP_KEYS[step]);

  return (
    <div>
      {/* כותרת + מחוון שלבים */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/b/${slug}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← {businessName}
          </Link>
          <span className="text-sm text-slate-400">
            {displayIndex + 1}/{visibleStepKeys.length}
          </span>
        </div>
        <div className="flex gap-1">
          {visibleStepKeys.map((k, i) => (
            <div
              key={k}
              className={`h-1.5 flex-1 rounded-full ${i <= displayIndex ? 'bg-brand-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t.booking.steps[STEP_KEYS[step]]}</h1>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {/* ----- שלב 0: שירותים ----- */}
      {step === 0 ? (
        <div className="space-y-2">
          <p className="mb-3 text-slate-600">{t.booking.chooseServices}</p>
          {services.map((s) => {
            const checked = selectedServiceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-right transition ${
                  checked
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  {!s.hideDuration ? (
                    <p className="text-sm text-slate-500">{formatDuration(s.durationMin)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {!s.hidePrice ? (
                    <span className="font-semibold text-slate-900">
                      {formatAgorot(s.priceAgorot)}
                    </span>
                  ) : null}
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs text-white ${
                      checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ----- שלב 1: איש צוות ----- */}
      {step === 1 ? (
        <div className="space-y-2">
          <p className="mb-3 text-slate-600">{t.booking.chooseStaff}</p>
          {staff.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setStaffId(m.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-right transition ${
                staffId === m.id
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                {m.displayName.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{m.displayName}</p>
                {m.title ? <p className="text-sm text-slate-500">{m.title}</p> : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* ----- שלב 2: תאריך ----- */}
      {step === 2 ? (
        <div>
          <p className="mb-3 text-slate-600">{t.booking.chooseDate}</p>
          <input
            type="date"
            value={date}
            min={todayDateString()}
            max={addDaysToDateString(todayDateString(), 60)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg"
          />
          <p className="mt-3 text-center text-slate-600">{formatLongDate(date)}</p>
        </div>
      ) : null}

      {/* ----- שלב 3: שעה ----- */}
      {step === 3 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-slate-600">{t.booking.chooseTime}</p>
            <input
              type="date"
              value={date}
              min={todayDateString()}
              max={addDaysToDateString(todayDateString(), 60)}
              onChange={(e) => changeDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          {slotsLoading ? (
            <p className="py-8 text-center text-slate-400">{t.common.loading}</p>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{t.booking.noSlots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.startAtUtc}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-lg border py-2.5 text-center font-medium transition ${
                    selectedSlot?.startAtUtc === slot.startAtUtc
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ----- שלב 4: סיכום ----- */}
      {step === 4 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.booking.service}</dt>
                <dd className="text-left font-medium text-slate-900">
                  {selectedServices.map((s) => s.name).join(', ')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.booking.staff}</dt>
                <dd className="font-medium text-slate-900">{selectedStaff?.displayName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.booking.date}</dt>
                <dd className="font-medium text-slate-900">{formatLongDate(date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.booking.time}</dt>
                <dd className="font-medium text-slate-900">{selectedSlot?.label}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3">
                <dt className="text-slate-500">{t.booking.totalDuration}</dt>
                <dd className="font-medium text-slate-900">{formatDuration(totalDuration)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.booking.totalPrice}</dt>
                <dd className="text-lg font-bold text-slate-900">{formatAgorot(totalPrice)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* ----- שלב 5: אישור (הזמנת אורח, ללא OTP) ----- */}
      {step === 5 ? (
        <div className="space-y-4">
          {/* כניסת לקוח חוזר עם גוגל: ממלא פרטים אוטומטית ומרכז את ההזמנות באזור האישי */}
          {!authed && googleEnabled ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center">
              <p className="mb-3 text-sm text-slate-600">{t.account.googlePrompt}</p>
              <CustomerGoogleSignIn callbackUrl={`/account/continue?next=${encodeURIComponent(`/b/${slug}/book`)}`} />
            </div>
          ) : null}
          <p className="text-slate-600">{requireEmail ? t.booking.guestHintPremium : t.booking.guestHintStandard}</p>
          <div>
            <label className="mb-1 block text-sm text-slate-600">{t.booking.guestName}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.booking.guestNamePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">{t.booking.guestPhone}</label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.booking.guestPhonePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
          {showEmailField ? (
            <div>
              <label className="mb-1 block text-sm text-slate-600">{t.booking.guestEmail}</label>
              <input
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.booking.guestEmailPlaceholder}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy || !name.trim() || !phone.trim() || (showEmailField && !email.trim())}
            onClick={submitBooking}
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? t.common.loading : t.booking.confirmBooking}
          </button>
        </div>
      ) : null}

      {/* ----- ניווט בין שלבים ----- */}
      {step < 5 ? (
        <div className="mt-8 flex gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 2 && singleStaff ? 0 : ((s - 1) as Step)))}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t.common.back}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canProceed[step]}
            onClick={() => {
              if (step === 0 && singleStaff) {
                setStep(2);
              } else if (step === 2) {
                goToTime();
              } else {
                setStep((s) => (s + 1) as Step);
              }
            }}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {step === 4 ? t.booking.continueToConfirm : t.common.next}
          </button>
        </div>
      ) : (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t.common.back}
          </button>
        </div>
      )}
    </div>
  );
}
