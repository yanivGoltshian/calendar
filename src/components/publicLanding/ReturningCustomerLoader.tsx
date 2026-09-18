'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import ReturningCustomer, { type ReturningAppointmentView } from './ReturningCustomer';
import BookingConfirmationBanner from './BookingConfirmationBanner';
import { t } from '@/i18n';

type ReturningData =
  | { mode: 'returning'; name: string; appointments: ReturningAppointmentView[] }
  | { mode: 'booked'; heading: string; appointments: ReturningAppointmentView[] }
  | { mode: 'none'; appointments: ReturningAppointmentView[] };

const appointmentSchema: z.ZodType<ReturningAppointmentView> = z.object({
  id: z.string(),
  title: z.string(),
  staffLabel: z.string(),
  whenLabel: z.string(),
  googleUrl: z.string().url(),
  canCancel: z.boolean(),
});
const dataSchema: z.ZodType<ReturningData> = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('returning'),
    name: z.string(),
    appointments: z.array(appointmentSchema),
  }),
  z.object({
    mode: z.literal('booked'),
    heading: z.string(),
    appointments: z.array(appointmentSchema),
  }),
  z.object({ mode: z.literal('none'), appointments: z.array(appointmentSchema) }),
]);

/**
 * Keep personal appointments outside the shared ISR page. Guest redirects only
 * receive the generic confirmation. Requires Suspense for useSearchParams.
 */
export default function ReturningCustomerLoader({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const booked = searchParams.get('booked');
  const [data, setData] = useState<ReturningData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    const url = booked
      ? `/api/public/b/${encodeURIComponent(slug)}/returning?booked=${encodeURIComponent(booked)}`
      : `/api/public/b/${encodeURIComponent(slug)}/returning`;
    fetch(url, { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`returning_appointments_http_${res.status}`);
        return res.json();
      })
      .then((json: unknown) => {
        if (!controller.signal.aborted) setData(dataSchema.parse(json));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('returning_appointments_load_failed', error);
          setFailed(true);
        }
      });
    return () => {
      controller.abort();
    };
  }, [slug, booked, attempt]);

  if (failed) {
    const r = t.premiumLanding.clinic.returning;
    return (
      <div role="alert" className="mt-8 text-sm text-[color:var(--c-muted,#6e655f)]">
        <p>{r.loadingError}</p>
        <button
          type="button"
          className="mt-2 rounded-full border border-current px-3.5 py-2 font-bold"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {r.retry}
        </button>
      </div>
    );
  }

  if (!data || data.mode === 'none') return null;

  if (data.mode === 'booked') {
    return <BookingConfirmationBanner heading={data.heading} />;
  }

  return (
    <ReturningCustomer
      key={slug}
      slug={slug}
      name={data.name}
      appointments={data.appointments}
    />
  );
}
