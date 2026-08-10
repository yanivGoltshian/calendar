'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import type { SaveState } from '../settings/actions';
import {
  ProfileFields,
  PolicyFields,
  TransparencyFields,
  TextsFields,
  RemindersFields,
  type ProfileValues,
  type PolicyValues,
  type TransparencyValues,
  type TextsValues,
  type RemindersValues,
} from '../settings/fields';
import {
  saveOnboardingProfile,
  saveOnboardingPolicy,
  saveOnboardingPresentation,
  finishOnboarding,
} from './actions';

const initialSaveState: SaveState = { ok: false };

type Props = {
  business: ProfileValues;
  settings: PolicyValues & TransparencyValues & TextsValues & RemindersValues;
};

const TOTAL = 4;

function errorText(state: SaveState): string | null {
  if (state.error === 'name') return t.admin.settings.profile.errorName;
  if (state.error === 'number') return t.admin.settings.policy.errorNumber;
  if (state.error) return t.admin.settings.errorGeneric;
  return null;
}

export default function OnboardingWizard({ business, settings }: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const [profileState, profileAction, profilePending] = useActionState(
    saveOnboardingProfile,
    initialSaveState,
  );
  const [policyState, policyAction, policyPending] = useActionState(
    saveOnboardingPolicy,
    initialSaveState,
  );
  const [presState, presAction, presPending] = useActionState(
    saveOnboardingPresentation,
    initialSaveState,
  );
  const [remState, remAction, remPending] = useActionState(
    finishOnboarding,
    initialSaveState,
  );

  useEffect(() => {
    if (profileState.ok) setStep(1);
  }, [profileState]);
  useEffect(() => {
    if (policyState.ok) setStep(2);
  }, [policyState]);
  useEffect(() => {
    if (presState.ok) setStep(3);
  }, [presState]);
  useEffect(() => {
    if (remState.ok) setDone(true);
  }, [remState]);

  const o = t.admin.onboarding;

  if (done) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">{o.done.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{o.done.body}</p>
        <p className="mt-1 text-xs text-slate-500">{o.done.editHint}</p>
        <Link
          href="/admin"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 font-semibold text-white transition hover:bg-brand-700"
        >
          {o.done.cta}
        </Link>
      </section>
    );
  }

  const stepKeys = ['profile', 'policy', 'presentation', 'reminders'] as const;
  const stepKey = stepKeys[step];
  const progress = o.progress
    .replace('{current}', String(step + 1))
    .replace('{total}', String(TOTAL));

  function backButton() {
    if (step === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setStep((n) => Math.max(0, n - 1))}
        className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {o.back}
      </button>
    );
  }

  function submitButton(pending: boolean, isFinal: boolean) {
    return (
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-6 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? o.saving : isFinal ? o.finish : o.next}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm font-medium text-brand-700">{progress}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{o.steps[stepKey]}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{o.stepIntro[stepKey]}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {step === 0 ? (
          <form action={profileAction} className="space-y-4">
            <ProfileFields b={business} />
            {errorText(profileState) ? (
              <p className="text-sm text-red-600">{errorText(profileState)}</p>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div />
              {submitButton(profilePending, false)}
            </div>
          </form>
        ) : null}

        {step === 1 ? (
          <form action={policyAction} className="space-y-4">
            <PolicyFields s={settings} />
            {errorText(policyState) ? (
              <p className="text-sm text-red-600">{errorText(policyState)}</p>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-2">
              {backButton()}
              {submitButton(policyPending, false)}
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <form action={presAction} className="space-y-4">
            <TransparencyFields s={settings} />
            <TextsFields s={settings} />
            {errorText(presState) ? (
              <p className="text-sm text-red-600">{errorText(presState)}</p>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-2">
              {backButton()}
              {submitButton(presPending, false)}
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <form action={remAction} className="space-y-4">
            <RemindersFields s={settings} />
            {errorText(remState) ? (
              <p className="text-sm text-red-600">{errorText(remState)}</p>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-2">
              {backButton()}
              {submitButton(remPending, true)}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
