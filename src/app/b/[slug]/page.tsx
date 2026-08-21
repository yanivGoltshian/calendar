import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatMinutes } from '@/lib/time';
import { localBusinessJsonLd } from '@/lib/seo';
import { buildBusinessPageMetadata } from './metadata';
import { JsonLd } from '@/components/JsonLd';
import InstallApp from '@/components/pwa/InstallApp';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import { darken, lighten, withAlpha } from '@/lib/hexColor';
import {
  sectionIconKey,
  landingDefaults,
  normalizeLandingContent,
  normalizePublicPageStyle,
} from '@/lib/publicPageStyle';
import {
  MapPinIcon,
  PhoneIcon,
  InstagramIcon,
  ClockIcon,
  UsersIcon,
  SectionIcon,
} from '@/components/publicLanding/icons';
import LandingHero from '@/components/publicLanding/LandingHero';
import LandingSections from '@/components/publicLanding/LandingSections';
import PremiumClinicHeader from '@/components/publicLanding/PremiumClinicHeader';

type Props = {
  params: Promise<{ slug: string }>;
  // אפשרות תצוגה מקדימה בלבד לאורחים (בוחר ה-/demo): 'landing' או 'booking'.
  // לעולם לא נשמר ולא נכתב ל-DB, רק משפיע על הרינדור של הבקשה הנוכחית.
  searchParams?: Promise<{ style?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  return buildBusinessPageMetadata(business);
}

export default async function BusinessPublicPage({ params, searchParams }: Props) {
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
  // תצוגה מקדימה בלבד: פרמטר ?style=landing|booking מאפשר לאורח לצפות בשני הסגנונות
  // (משמש את בוחר ה-/demo). זו עקיפה מקומית לרינדור בלבד, לא נשמרת ולא נכתבת ל-DB.
  const styleParam = ((await searchParams) ?? {}).style?.toLowerCase();
  const pageStyle =
    styleParam === 'landing'
      ? 'LANDING'
      : styleParam === 'booking'
        ? 'BOOKING'
        : normalizePublicPageStyle(business.publicPageStyle);
  const isLanding = pageStyle === 'LANDING';
  const iconKey = sectionIconKey(business.type);

  const landing = normalizeLandingContent(business.landingContent);
  const defaults = landingDefaults(business.type);
  const heroHeadline = landing?.heroHeadline ?? defaults.heroHeadline;
  const heroSubtext = landing?.heroSubtext ?? defaults.heroSubtext;
  const heroEyebrow = landing?.heroEyebrow ?? t.publicPage.landing.eyebrow;
  const heroCtaLabel = landing?.ctaLabel || t.publicPage.bookCta;

  const bookHref = `/b/${business.slug}/book`;

  // עמוד פרימיום של קליניקה — מזוהה לפי נוכחות launchOffer או hotDeals בתוכן הנחיתה.
  // רק אז מוחלת הפלטה החמה (זהב/קרם) והכותרת הייעודית, בלי לפגוע בשאר העסקים.
  const isClinicPremium = isLanding && Boolean(landing?.launchOffer || landing?.hotDeals);
  const todayWorkingHours = hoursByDay.get(todayIdx);
  const todayHours = todayWorkingHours
    ? `${formatMinutes(todayWorkingHours.startMinute)}–${formatMinutes(todayWorkingHours.endMinute)}`
    : null;
  const clinicLabels = t.premiumLanding.clinic;
  // משתני הפלטה החמה מוזרקים רק בעמוד הקליניקה; שאר העסקים נשארים עם ‎--biz-*‎ בלבד.
  const clinicThemeVars = {
    '--c-gold': '#c6a86a',
    '--c-gold-strong': '#a6863f',
    '--c-gold-text': '#8c6748',
    '--c-cream': '#faf6ef',
    '--c-ink': '#1b1715',
    '--c-brand': '#b0855f',
    '--biz-strong': '#8c6748',
  } as unknown as CSSProperties;
  const rootStyle = isClinicPremium
    ? ({ ...themeVars, ...clinicThemeVars } as CSSProperties)
    : themeVars;

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

  return (
    <main
      dir="rtl"
      style={rootStyle}
      className={`min-h-screen pb-28 ${isClinicPremium ? 'bg-[color:var(--c-cream,#faf6ef)]' : 'bg-slate-50'}`}
    >
      <JsonLd data={jsonLd} />

      {isClinicPremium ? (
        /* כותרת פרימיום של הקליניקה — סרגל כהה, ניווט קרם, פס מבצע והירו המפוצל */
        <PremiumClinicHeader
          name={business.name}
          logoUrl={business.logoUrl}
          phone={business.phone}
          todayHours={todayHours}
          instagramUrl={landing?.socialLinks?.instagram ?? business.instagramUrl ?? null}
          facebookUrl={landing?.socialLinks?.facebook ?? null}
          bookHref={bookHref}
          heroImages={landing?.heroImages ?? []}
          heroEyebrow={heroEyebrow}
          heroHeadline={heroHeadline}
          heroSubtext={heroSubtext}
          heroCtaLabel={heroCtaLabel}
          launchOffer={landing?.launchOffer}
          labels={{
            bookCta: clinicLabels.bookCta,
            navServices: clinicLabels.navServices,
            navOffers: clinicLabels.navOffers,
            navLocation: clinicLabels.navLocation,
            hoursToday: clinicLabels.topbarHoursToday,
            closedToday: clinicLabels.topbarClosedToday,
            offerSpots: clinicLabels.offerSpots,
            offerEndsIn: clinicLabels.offerEndsIn,
            offerClose: clinicLabels.offerClose,
            callAria: clinicLabels.callAria,
            instagramAria: clinicLabels.instagramAria,
            facebookAria: clinicLabels.facebookAria,
            heroImageAlt: clinicLabels.heroImageAlt,
            heroSecondaryCta: t.premiumLanding.heroSecondaryCta,
            countdown: clinicLabels.countdown,
          }}
        />
      ) : (
        /* קאבר מותגי — צבע נגזר מצבע המותג של העסק */
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
                <LandingHero
                  eyebrow={heroEyebrow}
                  headline={heroHeadline}
                  subtext={heroSubtext}
                  ctaLabel={heroCtaLabel}
                  bookHref={bookHref}
                />
              ) : null}
            </div>
          </div>
          <div
            className="h-1.5 w-full"
            style={{ backgroundImage: 'linear-gradient(90deg, var(--biz-dark), var(--biz-light), var(--biz-dark))' }}
          />
        </header>
      )}

      <div className="mx-auto max-w-3xl px-5">
        {isLanding ? (
          <LandingSections
            content={landing}
            type={business.type}
            services={services}
            workingHours={business.workingHours}
            address={business.address}
            phone={business.phone}
            bookHref={bookHref}
            iconKey={iconKey}
            todayIdx={todayIdx}
          />
        ) : (
          <>
            {/* על העסק */}
            {business.description ? (
              <section className="mt-8">
                <h2 className="mb-2 text-lg font-semibold text-slate-900">{t.publicPage.aboutTitle}</h2>
                <p className="whitespace-pre-line leading-relaxed text-slate-700">{business.description}</p>
              </section>
            ) : null}

            {servicesSection}
            {staffSection}
            {hoursSection}
          </>
        )}

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
