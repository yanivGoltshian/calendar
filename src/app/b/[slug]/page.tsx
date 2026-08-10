import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  return { title: business?.name ?? 'עסק' };
}

export default async function BusinessPublicPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const services = business.services;

  return (
    <main className="mx-auto max-w-2xl pb-24">
      {/* תמונת נושא */}
      <div className="relative h-44 w-full bg-gradient-to-l from-brand-600 to-brand-700 sm:h-56">
        {business.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="px-5">
        {/* לוגו + שם */}
        <div className="-mt-12 flex items-end gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logoUrl} alt={business.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-brand-600">
                {business.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
            {business.address ? (
              <p className="text-sm text-slate-500">{business.address}</p>
            ) : null}
          </div>
        </div>

        {/* תיאור */}
        {business.description ? (
          <p className="mt-5 whitespace-pre-line leading-relaxed text-slate-700">
            {business.description}
          </p>
        ) : null}

        {/* אינסטגרם */}
        {business.instagramUrl ? (
          <a
            href={business.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <span aria-hidden>◐</span>
            {t.publicPage.instagram}
          </a>
        ) : null}

        {/* שירותים */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            {t.publicPage.servicesTitle}
          </h2>
          {services.length === 0 ? (
            <p className="text-slate-500">{t.publicPage.noServices}</p>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{s.name}</p>
                    {!s.hideDuration ? (
                      <p className="text-sm text-slate-500">{formatDuration(s.durationMin)}</p>
                    ) : null}
                  </div>
                  {!s.hidePrice ? (
                    <span className="font-semibold text-slate-900">
                      {formatAgorot(s.priceAgorot)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* שורת קרדיט */}
        <p className="mt-10 text-center text-sm text-slate-400">{t.publicPage.creditLine}</p>
      </div>

      {/* CTA קבוע בתחתית */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/b/${business.slug}/book`}
            className="block w-full rounded-xl bg-brand-600 py-3.5 text-center text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            {t.publicPage.bookCta}
          </Link>
        </div>
      </div>
    </main>
  );
}
