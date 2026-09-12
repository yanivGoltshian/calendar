import Link from 'next/link';
import { getFirstBusiness } from '@/server/repos/business';
import { buildMetadata } from '@/lib/seo';
import { t } from '@/i18n';
import { Navbar, Footer, Container, Section, Badge, Card, Button } from '@/components/ui';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';

// קריאת העסק להדגמה היא קריאת DB, לכן הדף דינמי ואינו ניגש למסד בזמן build.
export const dynamic = 'force-dynamic';

const r = t.marketing.roadmap;
const honest = t.marketing.migrate.honest;

export const metadata = buildMetadata({
  title: r.metaTitle,
  description: r.metaDescription,
  path: '/roadmap',
});

/**
 * עמוד /roadmap — "מה מוכן היום ומה בדרך".
 * בלוק השקיפות (migrate.honest) הועבר לכאן מדף הבית כדי שהעמוד הראשי יתמקד בערך —
 * זימון תורים — ולא ברשימת מה שעדיין בפיתוח. התוכן נשמר במלואו.
 */
export default async function RoadmapPage() {
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
            {r.backToHome}
          </Link>
        </Container>

        <Section>
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="accent" className="mb-4">
                {r.badge}
              </Badge>
              <h1 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {r.title} <span className="text-gradient">{r.titleAccent}</span>
              </h1>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{r.subtitle}</p>
            </Reveal>

            <Stagger className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
              <StaggerItem>
                <Card className="flex h-full flex-col gap-4 p-7">
                  <Badge tone="brand" className="w-fit">
                    {honest.readyLabel}
                  </Badge>
                  <p className="leading-relaxed text-sand-700 dark:text-sand-200">{honest.ready}</p>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="flex h-full flex-col gap-4 p-7">
                  <Badge tone="accent" className="w-fit">
                    {honest.soonLabel}
                  </Badge>
                  <p className="leading-relaxed text-sand-700 dark:text-sand-200">{honest.soon}</p>
                </Card>
              </StaggerItem>
            </Stagger>

            <Reveal className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row" delay={0.1}>
              <Button href="/business/new" size="lg" className="w-full sm:w-auto">
                {t.marketing.nav.cta}
              </Button>
              {demoHref && (
                <Button href={demoHref} variant="secondary" size="lg" className="w-full sm:w-auto">
                  {t.marketing.migrate.secondaryCta}
                </Button>
              )}
            </Reveal>
          </Container>
        </Section>
      </main>

      <Footer demoSlug={demoSlug} absoluteLinks />
    </div>
  );
}
