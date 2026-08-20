import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatMinutes } from '@/lib/time';
import { buildMetadata, localBusinessJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import InstallApp from '@/components/pwa/InstallApp';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import { darken, lighten, withAlpha } from '@/lib/hexColor';
import {
  sectionIconKey,
  landingDefaults,
  normalizeLandingContent,
  normalizePublicPageStyle,
  type SectionIconKey,
} from '@/lib/publicPageStyle';

type Props = { params: Promise<{ slug: string }> };

type IconProps = { className?: string };

function svgProps(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ScissorsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1 21 21M8.1 15.9 21 3" />
    </svg>
  );
}

function DumbbellIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 9v6M7 5v14M17 5v14M20 9v6M7 12h10" />
    </svg>
  );
}

function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M3 3h2.5M13.5 3H16" />
      <path d="M9.5 14v1a5.5 5.5 0 0 0 5.5 5.5 3.5 3.5 0 0 0 3.5-3.5V13" />
      <circle cx="18.5" cy="11" r="2" />
    </svg>
  );
}

function LeafIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 20c0-8 6-14 16-16-2 10-8 16-16 16Z" />
      <path d="M4 20 14 10" />
    </svg>
  );
}

function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
    </svg>
  );
}

function SparklesIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M10 3l1.4 3.9L15 8.3l-3.6 1.4L10 13.6 8.6 9.7 5 8.3l3.6-1.4Z" />
      <path d="M17.5 13l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" />
    </svg>
  );
}

function EyeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function NeedleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 21l5-5" />
      <path d="M8 16 18 6a2.1 2.1 0 0 0-3-3L5 13Z" />
      <path d="M6 12l3 3" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
    </svg>
  );
}

function SectionIcon({ iconKey, className }: { iconKey: SectionIconKey; className?: string }) {
  switch (iconKey) {
    case 'scissors':
      return <ScissorsIcon className={className} />;
    case 'dumbbell':
      return <DumbbellIcon className={className} />;
    case 'stethoscope':
      return <StethoscopeIcon className={className} />;
    case 'leaf':
      return <LeafIcon className={className} />;
    case 'sparkle':
      return <SparkleIcon className={className} />;
    case 'eye':
      return <EyeIcon className={className} />;
    case 'needle':
      return <NeedleIcon className={className} />;
    case 'sparkles':
      return <SparklesIcon className={className} />;
    case 'calendar':
    default:
      return <CalendarIcon className={className} />;
  }
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

  // מיתוג צבע לכל עסק (באג 2): כל הגוונים נגזרים מצבע המותג שנבחר באונבורדינג.
  const brand = resolveBrandColor(business.brandColor);
  const ink = readableText(brand);
  const themeVars = {
    '--biz': brand,
    '--biz-strong': darken(brand, 0.18),
    '--biz-dark': darken(brand, 0.36),
    '--biz-light': lighten(brand, 0.16),
    '--biz-ink': ink,
    '--biz-ink-strong': darken(brand, 0.34),
    '--biz-soft': withAlpha(brand, 0.1),
    '--biz-softer': withAlpha(brand, 0.05),
    '--biz-border': withAlpha(brand, 0.22),
  } as unknown as CSSProperties;

  // מצב העמוד (באג 3): הזמנת תורים ממוקדת מול עמוד נחיתה עשיר, נשלט מהניהול.
  const pageStyle = normalizePublicPageStyle(business.publicPageStyle);
  const isLanding = pageStyle === 'LANDING';
  const iconKey = sectionIconKey(business.type);

  const landing = normalizeLandingContent(business.landingContent);
  const defaults = landingDefaults(business.type);
  const heroHeadline = landing?.heroHeadline ?? defaults.heroHeadline;
  const heroSubtext = landing?.heroSubtext ?? defaults.heroSubtext;
  const benefits = landing?.benefits?.length ? landing.benefits : defaults.benefits;
  const gallery = landing?.galleryImageUrls ?? [];
  const testimonials = landing?.testimonials ?? [];

  const bookHref = `/b/${business.slug}/book`;

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

  const contactRows = (
    <div className="mt-2.5 space-y-1.5">
      {business.address ? (
        <p className="flex items-center gap-1.5 text-sm opacity-90">
          <MapPinIcon className="h-4 w-4 shrink-0 opacity-80" />
          <span>{business.address}</span>
        </p>
      ) : null}
      {business.phone ? (
        <a href={`tel:${business.phone}`} className="flex items-center gap-1.5 text-sm opacity-90 transition hover:opacity-100">
          <PhoneIcon className="h-4 w-4 shrink-0 opacity-80" />
          <span dir="ltr">{business.phone}</span>
        </a>
      ) : null}
      {business.instagramUrl ? (
        <a
          href={business.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm opacity-90 transition hover:opacity-100"
        >
          <InstagramIcon className="h-4 w-4 shrink-0 opacity-80" />
          <span>{t.publicPage.instagram}</span>
        </a>
      ) : null}
    </div>
  );

  const logoTile = (
    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-lg sm:h-20 sm:w-20">
      {business.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={business.logoUrl} alt={business.name} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="text-3xl font-bold text-[color:var(--biz-strong)] sm:text-4xl">{business.name.charAt(0)}</span>
      )}
    </div>
  );

  const servicesSection = (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <SectionIcon iconKey={iconKey} className="h-5 w-5 text-[color:var(--biz-strong)]" />
        {t.publicPage.servicesTitle}
      </h2>
      {services.length === 0 ? (
        <p className="text-slate-500">{t.publicPage.noServices}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--biz-border)] bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{s.name}</p>
                {!s.hideDuration ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    {formatDuration(s.durationMin)}
                  </p>
                ) : null}
              </div>
              {!s.hidePrice ? (
                <span className="shrink-0 ps-3 font-bold text-[color:var(--biz-ink-strong)]">{formatAgorot(s.priceAgorot)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const staffSection = staff.length > 0 ? (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <UsersIcon className="h-5 w-5 text-[color:var(--biz-strong)]" />
        {t.publicPage.teamTitle}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {staff.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-4 rounded-2xl border border-[color:var(--biz-border)] bg-white p-4 shadow-sm"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--biz-soft)] ring-2 ring-[color:var(--biz-border)]">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt={m.displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-[color:var(--biz-strong)]">{m.displayName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{m.displayName}</p>
              {m.title ? <p className="text-sm font-medium text-[color:var(--biz-ink-strong)]">{m.title}</p> : null}
              {m.bio ? <p className="mt-1 text-sm leading-snug text-slate-600">{m.bio}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const hoursSection = business.workingHours.length > 0 ? (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <ClockIcon className="h-5 w-5 text-[color:var(--biz-strong)]" />
        {t.publicPage.hoursTitle}
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-white shadow-sm">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const wh = hoursByDay.get(d);
          const isToday = d === todayIdx;
          return (
            <li
              key={d}
              className={`flex items-center justify-between px-4 py-2.5 text-sm ${d > 0 ? 'border-t border-slate-100' : ''} ${isToday ? 'bg-[var(--biz-soft)] font-semibold' : ''}`}
            >
              <span className="text-slate-900">{t.publicPage.weekdays[d]}</span>
              {wh ? (
                <span dir="ltr" className="tabular-nums text-slate-700">
                  {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                </span>
              ) : (
                <span className="text-slate-400">{t.publicPage.hoursClosed}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

  const benefitsSection = isLanding ? (
    <section className="mt-10 grid gap-3 sm:grid-cols-3">
      {benefits.map((b, i) => (
        <div key={i} className="rounded-2xl border border-[color:var(--biz-border)] bg-white p-5 shadow-sm">
          <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--biz-soft)] text-[color:var(--biz-strong)]">
            <CheckIcon className="h-5 w-5" />
          </span>
          <p className="font-semibold text-slate-900">{b.title}</p>
          {b.text ? <p className="mt-1 text-sm leading-snug text-slate-600">{b.text}</p> : null}
        </div>
      ))}
    </section>
  ) : null;

  const gallerySection = isLanding && gallery.length > 0 ? (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{t.publicPage.landing.galleryTitle}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {gallery.map((url, i) => (
          <div key={i} className="aspect-[4/3] overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const testimonialsSection = isLanding && testimonials.length > 0 ? (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{t.publicPage.landing.testimonialsTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {testimonials.map((tm, i) => (
          <figure key={i} className="rounded-2xl border border-[color:var(--biz-border)] bg-white p-5 shadow-sm">
            <blockquote className="text-sm leading-relaxed text-slate-700">“{tm.quote}”</blockquote>
            {tm.name ? <figcaption className="mt-2 text-sm font-semibold text-[color:var(--biz-ink-strong)]">{tm.name}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  ) : null;

  const closingCta = isLanding ? (
    <section className="mt-10 rounded-3xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] px-5 py-8 text-center shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{t.publicPage.landing.ctaTitle}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{t.publicPage.landing.ctaText}</p>
      <Link
        href={bookHref}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-[var(--biz)] px-8 py-3 text-base font-bold text-[color:var(--biz-ink)] shadow-md transition hover:bg-[var(--biz-strong)]"
      >
        {t.publicPage.bookCta}
      </Link>
    </section>
  ) : null;

  return (
    <main dir="rtl" style={themeVars} className="min-h-screen bg-slate-50 pb-28">
      <JsonLd data={jsonLd} />

      {/* קאבר מותגי — צבע נגזר מצבע המותג של העסק */}
      <header className="relative overflow-hidden">
        <div
          className="relative"
          style={{ backgroundImage: 'linear-gradient(135deg, var(--biz-dark) 0%, var(--biz) 58%, var(--biz-light) 130%)' }}
        >
          {business.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
          ) : null}
          <div
            className="relative mx-auto max-w-3xl px-5 pb-9 pt-10 sm:pb-12 sm:pt-16"
            style={{ color: 'var(--biz-ink)' }}
          >
            {logoTile}
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{business.name}</h1>
            {contactRows}

            {isLanding ? (
              <div className="mt-6 max-w-xl">
                <p className="text-2xl font-extrabold leading-snug sm:text-3xl">{heroHeadline}</p>
                <p className="mt-2 text-sm leading-relaxed opacity-90 sm:text-base">{heroSubtext}</p>
                <Link
                  href={bookHref}
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-base font-bold text-[color:var(--biz-ink-strong)] shadow-md transition hover:bg-white/90"
                >
                  {t.publicPage.bookCta}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="h-1.5 w-full"
          style={{ backgroundImage: 'linear-gradient(90deg, var(--biz-dark), var(--biz-light), var(--biz-dark))' }}
        />
      </header>

      <div className="mx-auto max-w-3xl px-5">
        {/* על העסק */}
        {business.description ? (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">{t.publicPage.aboutTitle}</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{business.description}</p>
          </section>
        ) : null}

        {benefitsSection}
        {servicesSection}
        {gallerySection}
        {staffSection}
        {testimonialsSection}
        {hoursSection}
        {closingCta}

        {/* התקנת אפליקציה ממותגת של העסק */}
        <div className="mt-10">
          <InstallApp
            variant="business"
            appName={business.name}
            logoUrl={business.logoUrl}
            brandColor={business.brandColor}
          />
        </div>

        {/* שורת קרדיט מותג — קרדיט הפלטפורמה, נשאר בצבעי תור צ׳יק */}
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

      {/* CTA קבוע בתחתית — בצבע המותג של העסק */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Link
            href={bookHref}
            style={{ backgroundImage: 'linear-gradient(90deg, var(--biz) 0%, var(--biz-strong) 100%)', color: 'var(--biz-ink)' }}
            className="block w-full rounded-xl py-3.5 text-center text-base font-bold shadow-md transition hover:opacity-95"
          >
            {t.publicPage.bookCta}
          </Link>
        </div>
      </div>
    </main>
  );
}
