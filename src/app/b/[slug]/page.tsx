import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatMinutes } from '@/lib/time';
import { buildMetadata, localBusinessJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import InstallApp from '@/components/pwa/InstallApp';

type Props = { params: Promise<{ slug: string }> };

type IconProps = { className?: string };

function MapPinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ScissorsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1 21 21M8.1 15.9 21 3" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: 'עסק' };

  return buildMetadata({
    title: business.name,
    description:
      business.description?.slice(0, 160) ??
      `קביעת תור אונליין אצל ${business.name}. בחירת שירות, בחירת מועד ואישור מיידי.`,
    path: `/b/${business.slug}`,
    ogTitle: business.name,
    ogSubtitle: business.address ?? undefined,
  });
}

export default async function BusinessPublicPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const services = business.services;
  const staff = business.staff;
  const hoursByDay = new Map<number, (typeof business.workingHours)[number]>();
  for (const wh of business.workingHours) hoursByDay.set(wh.weekday, wh);
  const todayIdx = new Date().getDay();

  const jsonLd = localBusinessJsonLd({
    name: business.name,
    slug: business.slug,
    description: business.description,
    address: business.address,
    phone: business.phone,
    image: business.coverImageUrl ?? business.logoUrl,
    instagramUrl: business.instagramUrl,
    priceRange: '₪₪',
  });

  return (
    <main dir="rtl" className="min-h-screen bg-sand-50 pb-28">
      <JsonLd data={jsonLd} />

      {/* קאבר מותגי עם דמות בעל העסק */}
      <header className="relative overflow-hidden">
        <div className="relative bg-brand-sheen">
          {business.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          ) : null}
          <div className="relative mx-auto flex max-w-3xl items-end justify-between gap-3 px-5 pb-8 pt-10 sm:pb-10 sm:pt-16">
            <div className="max-w-[62%] sm:max-w-[64%]">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-lg sm:h-20 sm:w-20">
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logoUrl} alt={business.name} className="h-full w-full object-contain p-1.5" />
                ) : (
                  <span className="text-3xl font-bold text-accent-500 sm:text-4xl">{business.name.charAt(0)}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{business.name}</h1>
              <div className="mt-2.5 space-y-1.5">
                {business.address ? (
                  <p className="flex items-center gap-1.5 text-sm text-brand-100">
                    <MapPinIcon className="h-4 w-4 shrink-0 text-accent-200" />
                    <span>{business.address}</span>
                  </p>
                ) : null}
                {business.phone ? (
                  <a href={`tel:${business.phone}`} className="flex items-center gap-1.5 text-sm text-brand-100 transition hover:text-white">
                    <PhoneIcon className="h-4 w-4 shrink-0 text-accent-200" />
                    <span dir="ltr">{business.phone}</span>
                  </a>
                ) : null}
                {business.instagramUrl ? (
                  <a
                    href={business.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-brand-100 transition hover:text-white"
                  >
                    <InstagramIcon className="h-4 w-4 shrink-0 text-accent-200" />
                    <span>{t.publicPage.instagram}</span>
                  </a>
                ) : null}
              </div>
            </div>

            {/* דמות יניב, בעל העסק */}
            <div className="relative shrink-0 self-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/mascots/adam-34.png"
                alt="יניב, בעל העסק"
                className="h-36 w-auto object-contain object-bottom drop-shadow-2xl sm:h-56"
              />
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-gradient-to-l from-accent-500 via-accent-200 to-accent-500" />
      </header>

      <div className="mx-auto max-w-3xl px-5">
        {/* על העסק */}
        {business.description ? (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold text-brand-900">{t.publicPage.aboutTitle}</h2>
            <p className="whitespace-pre-line leading-relaxed text-sand-700">{business.description}</p>
          </section>
        ) : null}

        {/* שירותים */}
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-brand-900">
            <ScissorsIcon className="h-5 w-5 text-accent-600" />
            {t.publicPage.servicesTitle}
          </h2>
          {services.length === 0 ? (
            <p className="text-sand-500">{t.publicPage.noServices}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-sand-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-accent-300 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-900">{s.name}</p>
                    {!s.hideDuration ? (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-sand-500">
                        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                        {formatDuration(s.durationMin)}
                      </p>
                    ) : null}
                  </div>
                  {!s.hidePrice ? (
                    <span className="shrink-0 ps-3 font-bold text-accent-700">{formatAgorot(s.priceAgorot)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* הצוות */}
        {staff.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-brand-900">
              <UsersIcon className="h-5 w-5 text-accent-600" />
              {t.publicPage.teamTitle}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {staff.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand-100 ring-2 ring-accent-200">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt={m.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-brand-600">{m.displayName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-900">{m.displayName}</p>
                    {m.title ? <p className="text-sm font-medium text-accent-700">{m.title}</p> : null}
                    {m.bio ? <p className="mt-1 text-sm leading-snug text-sand-600">{m.bio}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* שעות פעילות */}
        {business.workingHours.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-brand-900">
              <ClockIcon className="h-5 w-5 text-accent-600" />
              {t.publicPage.hoursTitle}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const wh = hoursByDay.get(d);
                const isToday = d === todayIdx;
                return (
                  <li
                    key={d}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${d > 0 ? 'border-t border-sand-100' : ''} ${isToday ? 'bg-accent-50 font-semibold' : ''}`}
                  >
                    <span className="text-brand-900">{t.publicPage.weekdays[d]}</span>
                    {wh ? (
                      <span dir="ltr" className="tabular-nums text-sand-700">
                        {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                      </span>
                    ) : (
                      <span className="text-sand-400">{t.publicPage.hoursClosed}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* התקנת אפליקציה ממותגת של העסק */}
        <div className="mt-10">
          <InstallApp
            variant="business"
            appName={business.name}
            logoUrl={business.logoUrl}
            brandColor={business.brandColor}
          />
        </div>

        {/* שורת קרדיט מותג */}
        <div className="mt-10 rounded-2xl bg-gradient-to-l from-brand-900 to-brand-700 px-5 py-6 text-center shadow-sm">
          <p className="text-sm text-brand-100">{t.publicPage.creditLine}</p>
          <Link
            href="/"
            className="mt-1.5 inline-block text-sm font-semibold text-accent-300 transition hover:text-accent-200"
          >
            {t.publicPage.creditCta}
          </Link>
        </div>
      </div>

      {/* CTA קבוע בתחתית */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/b/${business.slug}/book`}
            className="block w-full rounded-xl bg-gradient-to-l from-accent-500 to-accent-600 py-3.5 text-center text-base font-bold text-brand-950 shadow-md transition hover:from-accent-400 hover:to-accent-500"
          >
            {t.publicPage.bookCta}
          </Link>
        </div>
      </div>
    </main>
  );
}
