'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Business, BusinessSettings } from '@prisma/client';
import { t } from '@/i18n';
import SettingsSection from './SettingsSection';
import {
  ProfileFields,
  PolicyFields,
  TransparencyFields,
  TextsFields,
  RemindersFields,
} from './fields';
import { saveAllSettingsAction, type SaveState } from './actions';

const initialSaveState: SaveState = { ok: false };

/**
 * טופס הגדרות מאוחד: כל הסעיפים נשמרים יחד בכפתור 'שמירת הכול' אחד.
 * מוצגת רצועת שמירה נדבקת בתחתית שמופיעה רק כשיש שינויים שלא נשמרו,
 * ואחרי שמירה מוצג כרטיס 'מה הלאה' שמכוון לשלב הבא.
 */
export default function SettingsForm({
  business,
  settings,
  onboardingCompleted,
}: {
  business: Business;
  settings: BusinessSettings;
  onboardingCompleted: boolean;
}) {
  const s = t.admin.settings;
  const [state, formAction, pending] = useActionState(
    saveAllSettingsAction,
    initialSaveState,
  );
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const nextStepRef = useRef<HTMLDivElement | null>(null);

  function markDirty() {
    setDirty(true);
    setJustSaved(false);
    setShowToast(false);
  }

  // בעקבות שמירה מוצלחת: ניקוי מצב ה"שינויים", הצגת כרטיס ההמשך והודעת אישור.
  useEffect(() => {
    if (state.ok) {
      setDirty(false);
      setJustSaved(true);
      setShowToast(true);
    }
  }, [state]);

  // גלילה אל כרטיס ההמשך אחרי שנוצר, והעלמת הודעת האישור אחרי רגע.
  useEffect(() => {
    if (!justSaved) return;
    nextStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const id = setTimeout(() => setShowToast(false), 2500);
    return () => clearTimeout(id);
  }, [justSaved]);

  const errorText =
    state.error === 'name'
      ? s.profile.errorName
      : state.error === 'number'
        ? s.policy.errorNumber
        : state.error
          ? s.errorGeneric
          : null;

  const showBar = dirty || pending;

  return (
    <>
      <form action={formAction} onInput={markDirty} onChange={markDirty} className="space-y-6 pb-28">
        <SettingsSection title={s.profile.title} description={s.profile.description}>
          <ProfileFields b={business} />
        </SettingsSection>

        <SettingsSection title={s.policy.title} description={s.policy.description}>
          <PolicyFields s={settings} />
        </SettingsSection>

        <SettingsSection title={s.transparency.title} description={s.transparency.description}>
          <TransparencyFields s={settings} />
        </SettingsSection>

        <SettingsSection title={s.texts.title} description={s.texts.description}>
          <TextsFields s={settings} />
        </SettingsSection>

        <SettingsSection title={s.reminders.title} description={s.reminders.description}>
          <RemindersFields s={settings} />
        </SettingsSection>

        {justSaved ? (
          <div
            ref={nextStepRef}
            className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm text-white"
              >
                ✓
              </span>
              <h2 className="text-lg font-bold text-[#1b1715]">{s.nextStep.title}</h2>
            </div>
            <p className="mt-2 text-sm text-[#6e655f]">
              {onboardingCompleted ? s.nextStep.doneBody : s.nextStep.setupBody}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {onboardingCompleted ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  {s.nextStep.doneCta}
                </Link>
              ) : (
                <>
                  <Link
                    href="/admin/onboarding"
                    className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    {s.nextStep.setupCta}
                  </Link>
                  <Link
                    href="/admin"
                    className="inline-flex items-center rounded-lg border border-[#d6c8b4] px-5 py-2.5 text-sm font-medium text-[#4a4038] transition hover:bg-white"
                  >
                    {s.nextStep.setupSecondary}
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* רצועת שמירה נדבקת: מופיעה רק כשיש שינויים שלא נשמרו. */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#e7ddcd] bg-white/90 backdrop-blur transition-transform duration-300 ${
            showBar ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="min-w-0 text-sm">
              {errorText ? (
                <span className="font-medium text-red-600">{errorText}</span>
              ) : (
                <span className="text-[#8f8478]">{s.unsavedHint}</span>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? s.saving : s.saveAll}
            </button>
          </div>
        </div>
      </form>

      {/* הודעת אישור קצרה אחרי שמירה. */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center transition-opacity duration-300 ${
          showToast ? 'opacity-100' : 'opacity-0'
        }`}
        role="status"
        aria-live="polite"
      >
        <span className="rounded-full bg-[#1b1715] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {s.savedShort}
        </span>
      </div>
    </>
  );
}
