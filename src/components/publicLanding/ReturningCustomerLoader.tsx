'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReturningCustomer, {
  type ReturningAppointmentView,
} from './ReturningCustomer';

type ReturningData =
  | { mode: 'returning'; name: string; appointments: ReturningAppointmentView[] }
  | { mode: 'booked'; heading: string; appointments: ReturningAppointmentView[] }
  | { mode: 'none'; appointments: ReturningAppointmentView[] };

/**
 * טוען client-side את מקטע "שלום .." (תורים עתידיים של לקוח מזוהה) או את באנר
 * "התור שלך נקבע" לאורח לפי ?booked=<id>. הנתונים נשלפים מ-/api/public/b/{slug}/
 * returning אחרי הטעינה כדי שהשלד הסטטי (ISR) לא יכיל מידע אישי. משתמש ב-
 * useSearchParams ולכן חייב להיות עטוף ב-<Suspense> באתר הקריאה.
 */
export default function ReturningCustomerLoader({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const booked = searchParams.get('booked');
  const [data, setData] = useState<ReturningData | null>(null);

  useEffect(() => {
    let active = true;
    const url = booked
      ? `/api/public/b/${slug}/returning?booked=${encodeURIComponent(booked)}`
      : `/api/public/b/${slug}/returning`;
    fetch(url, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ReturningData | null) => {
        if (active) setData(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, booked]);

  if (!data || data.mode === 'none' || data.appointments.length === 0) return null;

  if (data.mode === 'booked') {
    return (
      <ReturningCustomer name="" slug={slug} heading={data.heading} appointments={data.appointments} />
    );
  }

  return <ReturningCustomer name={data.name} slug={slug} appointments={data.appointments} />;
}
