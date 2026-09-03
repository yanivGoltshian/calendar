import Link from 'next/link';
import { getFirstBusiness, getListedBusinesses, type ListedBusinessCard } from '@/server/repos/business';
import { buildMetadata } from '@/lib/seo';
import { t } from '@/i18n';
import { Navbar, Footer, Container, Section, Badge } from '@/components/ui';

// העמוד שולף עסקים מה-DB, לכן הוא דינמי (force-dynamic) ואינו ניגש למסד בזמן build.
// כך הסטטיות של דף הבית ושל עמודי העסק נשמרת, והרשימה נבנית בזמן בקשה עם SEO מלא.
export const dynamic = 'force-dynamic';

const d = t.marketing.directory;
const typeLabels = t.admin.settings.types;

export const metadata = buildMetadata({
  title: d.metaTitle,
  description: d.metaDescription,
  path: '/businesses',
});

/**
 * שליפה בטוחה של העסקים המוצגים. גם בעמוד דינמי אנו עוטפים את קריאת ה-DB
 * כדי שכשל זמני יחזיר רשימה ריקה ומצב ריק ידידותי במקום לקרוס.
 */
async function loadListed(): Promise<ListedBusinessCard[]> {
  try {
    return await getListedBusinesses();
  } catch {
    return [];
  }
}

async function loadDemoSlug(): Promise<string | undefined> {
  try {
    const business = await getFirstBusiness();
    return business?.slug;
  } catch {
    return undefined;
  }
}

/**
 * עמוד /businesses — ספריית העסקים הציבורית.
 * מרונדר בשרת (force-dynamic) לטובת SEO, מציג רק עסקים עם listed=true,
 * ובטוח מפני כשל DB (רשימה ריקה → מצב ריק ידידותי).
 */
export default async function BusinessesPage() {
  const [businesses, demoSlug] = await Promise.all([loadListed(), loadDemoSlug()]);

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 dark:bg-sand-950 dark:text-sand-50">
      <Navbar demoSlug={demoSlug} absoluteLinks />

      <main className="flex-1">
        <Container className="pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sand-500 transition-colors hover:text-brand-700 dark:text-sand-400 dark:hover:text-brand-200"
          >
            <span aria-hidden>→</span>
            {d.backToHome}
          </Link>
        </Container>

        <Section>
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <Badge tone="accent" className="mb-4">
                {d.badge}
              </Badge>
              <h1 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {d.title} <span className="text-gradient">{d.titleAccent}</span>
              </h1>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{d.subtitle}</p>
            </div>

            {businesses.length === 0 ? (
              <div className="mx-auto mt-12 max-w-md rounded-3xl border border-dashed border-sand-300 bg-white/60 p-10 text-center dark:border-sand-700 dark:bg-sand-900/40">
                <h2 className="font-display text-xl font-semibold text-sand-800 dark:text-sand-100">
                  {d.empty.title}
                </h2>
                <p className="mt-2 text-sand-600 dark:text-sand-300">{d.empty.body}</p>
              </div>
            ) : (
              <ul className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {businesses.map((business) => (
                  <li key={business.slug}>
                    <BusinessCard business={business} />
                  </li>
                ))}
              </ul>
            )}
          </Container>
        </Section>
      </main>

      <Footer demoSlug={demoSlug} absoluteLinks />
    </div>
  );
}

/** כרטיס עסק בודד: תמונת רקע/לוגו, שם, סוג, תיאור וכתובת, מקושר ל-/b/[slug]. */
function BusinessCard({ business }: { business: ListedBusinessCard }) {
  const { slug, name, description, address, type, logoUrl, coverImageUrl, brandColor } = business;
  const accent = brandColor ?? '#0ea5b7';
  const typeLabel = type ? typeLabels[type] : null;

  return (
    <Link
      href={`/b/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-sand-800 dark:bg-sand-900"
    >
      <div
        className="relative flex h-32 items-center justify-center overflow-hidden"
        style={
          coverImageUrl
            ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: `linear-gradient(135deg, ${accent}22, ${accent}66)` }
        }
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 rounded-2xl border border-white/70 bg-white object-contain shadow-sm"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-2xl bg-white/85 font-display text-2xl font-bold text-sand-700 shadow-sm"
          >
            {name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-sand-900 group-hover:text-brand-700 dark:text-sand-50 dark:group-hover:text-brand-200">
            {name}
          </h2>
          {typeLabel && (
            <span className="shrink-0 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-sand-600 dark:bg-sand-800 dark:text-sand-300">
              {typeLabel}
            </span>
          )}
        </div>

        {description && (
          <p className="line-clamp-2 text-sm text-sand-600 dark:text-sand-300">{description}</p>
        )}

        {address && (
          <p className="mt-auto flex items-center gap-1.5 pt-2 text-sm text-sand-500 dark:text-sand-400">
            <span aria-hidden>📍</span>
            <span className="line-clamp-1">{address}</span>
          </p>
        )}

        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-200">
          {d.viewCta}
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
        </span>
      </div>
    </Link>
  );
}
