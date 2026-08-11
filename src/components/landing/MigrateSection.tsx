import Image from 'next/image';
import { Section, Container, Badge, Button, Card } from '@/components/ui';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { t } from '@/i18n';

const m = t.marketing.migrate;
const mascots = t.marketing.mascots;

/**
 * MigrateSection — מסלול הגירה כן מפלטפורמה אחרת לתור צ׳יק.
 * ארבעה שלבים מבוססי-יכולות אמת + בלוק שקיפות שמפריד בין מה שזמין היום
 * (העברת לקוחות ידנית מלווה) לבין מה שעדיין בפיתוח (ייבוא קובץ בלחיצה).
 * אדם, בעל עסק, מלווה את המעבר.
 */
export function MigrateSection({ demoHref }: { demoHref?: string }) {
  const steps = Object.values(m.steps);

  return (
    <Section id="migrate" className="bg-sand-100/50 dark:bg-sand-900/30">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mb-4">
            {m.badge}
          </Badge>
          <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
            {m.title} <span className="text-gradient">{m.titleAccent}</span>
          </h2>
          <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.subtitle}</p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          {/* שלבי המעבר */}
          <Stagger className="grid gap-5 sm:grid-cols-2" gap={0.08}>
            {steps.map((step, i) => (
              <StaggerItem key={i}>
                <Card className="flex h-full flex-col gap-3 p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-gradient font-display text-lg font-bold text-white shadow-glow-soft">
                    {i + 1}
                  </span>
                  <h3 className="font-display text-lg font-bold text-sand-900 dark:text-sand-50">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                    {step.desc}
                  </p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          {/* אדם + בלוק שקיפות */}
          <Reveal delay={0.1} className="flex flex-col items-center gap-6">
            <Image
              src="/brand/mascots/adam-34.png"
              alt={mascots.migrateAlt}
              width={375}
              height={863}
              className="h-52 w-auto drop-shadow-xl sm:h-60"
            />
            <Card className="w-full p-6">
              <h3 className="mb-4 font-display text-lg font-bold text-sand-900 dark:text-sand-50">
                {m.honest.title}
              </h3>
              <div className="space-y-4">
                <div>
                  <Badge tone="brand" className="mb-2">
                    {m.honest.readyLabel}
                  </Badge>
                  <p className="text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                    {m.honest.ready}
                  </p>
                </div>
                <div className="border-t border-sand-200/70 pt-4 dark:border-sand-700/70">
                  <Badge tone="accent" className="mb-2">
                    {m.honest.soonLabel}
                  </Badge>
                  <p className="text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                    {m.honest.soon}
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        </div>

        <Reveal className="mt-10 text-center">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/admin" size="lg" className="w-full sm:w-auto">
              {m.cta}
            </Button>
            {demoHref && (
              <Button href={demoHref} variant="secondary" size="lg" className="w-full sm:w-auto">
                {m.secondaryCta}
              </Button>
            )}
          </div>
          <p className="mt-5 text-sm text-sand-500">{m.microcopy}</p>
        </Reveal>
      </Container>
    </Section>
  );
}

export default MigrateSection;
