import { getExampleBusinesses } from '@/server/repos/business';
import { buildMetadata } from '@/lib/seo';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Navbar, Footer, Container, Section, Button, Card, Badge } from '@/components/ui';
import { Reveal, FadeIn } from '@/components/motion';
import { SparkleIcon } from '@/components/landing/icons';

const m = t.marketing;

// תלוי ב-getFirstBusiness (DB) לגזירת ה-slug של עסק ההדגמה, ולכן דינמי.
export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: `${m.demo.title} · ${BRAND.name}`,
  path: '/demo',
});

/**
 * בוחר עמודי הדגמה (/demo): מאפשר לאורח לצפות בשני סגנונות העמוד הציבורי של אותו
 * עסק הדגמה, סטנדרט (BOOKING) ופרימיום (LANDING), דרך פרמטר ?style= לתצוגה מקדימה
 * בלבד. אין כתיבה ל-DB ואין seeding, הכל נגזר מעסק ההדגמה הקיים.
 */
export default async function DemoPage() {
  // סטנדרט = עסק שאינו פרימיום (מספרה); פרימיום = עסק ה-plan==='premium' (קליניקה skin-beauty).
  const { standard, premium } = await getExampleBusinesses();
  const standardSlug = standard?.slug;
  const premiumSlug = premium?.slug ?? standardSlug;
  const demoSlug = premiumSlug ?? standardSlug;

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 dark:bg-sand-950 dark:text-sand-50">
      <Navbar demoSlug={demoSlug} />
      <main className="flex-1">
        <Section className="pt-8 sm:pt-12">
          <Container className="max-w-4xl">
            <div className="text-center">
              <FadeIn>
                <Badge tone="brand" className="mb-5">
                  <span className="inline-flex items-center gap-1.5">
                    <SparkleIcon aria-hidden className="h-3.5 w-3.5" />
                    {m.demo.eyebrow}
                  </span>
                </Badge>
              </FadeIn>
              <Reveal>
                <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight text-sand-900 dark:text-sand-50 sm:text-4xl">
                  {m.demo.title}
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-sand-600 dark:text-sand-300">
                  {m.demo.subtitle}
                </p>
              </Reveal>
            </div>

            {standardSlug || premiumSlug ? (
              <Reveal delay={0.15}>
                <div className="mt-10 grid gap-6 sm:grid-cols-2">
                  <Card interactive className="flex flex-col text-center">
                    <h2 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                      {m.demo.standard.title}
                    </h2>
                    <p className="mt-3 flex-1 text-sand-600 dark:text-sand-300">
                      {m.demo.standard.description}
                    </p>
                    <Button
                      href={`/b/${standardSlug ?? premiumSlug}?style=booking`}
                      size="lg"
                      className="mt-6 w-full"
                    >
                      {m.demo.standard.cta}
                    </Button>
                  </Card>
                  <Card interactive className="flex flex-col text-center">
                    <h2 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                      {m.demo.premium.title}
                    </h2>
                    <p className="mt-3 flex-1 text-sand-600 dark:text-sand-300">
                      {m.demo.premium.description}
                    </p>
                    <Button
                      href={`/b/${premiumSlug}?style=landing`}
                      size="lg"
                      className="mt-6 w-full"
                    >
                      {m.demo.premium.cta}
                    </Button>
                  </Card>
                </div>
              </Reveal>
            ) : (
              <Reveal delay={0.15}>
                <Card className="mt-10 text-center">
                  <h2 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                    {m.demo.empty.title}
                  </h2>
                  <p className="mt-3 text-sand-600 dark:text-sand-300">
                    {m.demo.empty.description}
                  </p>
                </Card>
              </Reveal>
            )}

            <div className="mt-10 text-center">
              <Button href="/" variant="ghost" size="lg">
                {m.demo.back}
              </Button>
            </div>
          </Container>
        </Section>
      </main>
      <Footer demoSlug={demoSlug} />
    </div>
  );
}
