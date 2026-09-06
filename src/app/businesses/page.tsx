import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { getListedBusinesses } from '@/server/repos/publicDirectory';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'עסקים לקביעת תור', path: '/businesses' });

export default async function BusinessesPage() {
  const businesses = await getListedBusinesses();
  return <main dir="rtl" className="mx-auto max-w-5xl px-5 py-12">
    <Link href="/" className="text-brand-700">לעמוד הבית</Link>
    <h1 className="my-6 text-3xl font-bold">עסקים לקביעת תור</h1>
    {businesses.length ? <ul className="grid gap-5 sm:grid-cols-2">
      {businesses.map((business) => <li key={business.slug} className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold"><Link href={`/b/${business.slug}`}>{business.name.slice(0, 200)}</Link></h2>
        {business.description ? <p className="mt-3 text-slate-600">{business.description.slice(0, 220)}</p> : null}
        {business.address ? <p className="mt-2 text-sm text-slate-500">{business.address.slice(0, 200)}</p> : null}
        <Link href={`/b/${business.slug}`} className="mt-4 inline-block text-brand-700">לפרטים וקביעת תור</Link>
      </li>)}
    </ul> : <p>אין כרגע עסקים להצגה בספרייה.</p>}
  </main>;
}
