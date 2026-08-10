import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { getFirstBusiness } from '@/server/repos/business';

/**
 * דף הבית: הפניה עדינה לעמוד העסק לדוגמה ולממשק הניהול.
 * ב-MVP המערכת מכילה עסק יחיד; דף זה משמש כשער כניסה.
 */
export default async function HomePage() {
  const business = await getFirstBusiness();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-brand-700">{BRAND.name}</h1>
        <p className="text-lg text-slate-600">מערכת לקביעת תורים וניהול עסק</p>
      </div>

      {business ? (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/b/${business.slug}`}
            className="rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            לעמוד העסק לדוגמה
          </Link>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            לממשק הניהול
          </Link>
        </div>
      ) : (
        <p className="text-slate-500">
          לא נמצאו נתונים. הריצו <code className="rounded bg-slate-200 px-1">npm run db:seed</code>{' '}
          כדי לטעון נתוני דמו.
        </p>
      )}
    </main>
  );
}
