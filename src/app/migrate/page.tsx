import Link from 'next/link';
import { getFirstBusiness } from '@/server/repos/business';
import { buildMetadata } from '@/lib/seo';
import { t } from '@/i18n';
import { Navbar, Footer, Container } from '@/components/ui';
import { MigrateSection } from '@/components/landing/MigrateSection';

// קריאת העסק להדגמה היא קריאת DB, לכן הדף דינמי ואינו ניגש למסד בזמן build.
export const dynamic = 'force-dynamic';

const p = t.marketing.migrate.page;

export const metadata = buildMetadata({
  title: p.metaTitle,
  description: p.metaDescription,
  path: '/migrate',
});

/**
 * עמוד /migrate — מסלול המעבר מפלטפורמה אחרת לתור צ׳יק.
 * הועבר מדף הבית כדי לשמור עליו ממוקד וקליל. התוכן זהה (רכיב MigrateSection),
 * עם ניווט מלא (Navbar/Footer) שבו עוגני דף הבית מוחלטים.
 */
export default async function MigratePage() {
  const business = await getFirstBusiness();
  const demoSlug = business?.slug;
  const demoHref = demoSlug ? `/b/${demoSlug}` : undefined;

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
            {p.backToHome}
          </Link>
        </Container>

        <MigrateSection demoHref={demoHref} />
      </main>

      <Footer demoSlug={demoSlug} absoluteLinks />
    </div>
  );
}
