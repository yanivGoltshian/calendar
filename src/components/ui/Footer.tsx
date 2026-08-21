import Link from 'next/link';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { LEGAL_LINKS } from '@/content/legal/links';
import { Container } from './Container';

/** Footer — כותרת תחתונה עם קישורי שער, קרדיט ופרטי מותג. */
export function Footer({ demoSlug, absoluteLinks = false }: { demoSlug?: string; absoluteLinks?: boolean }) {
  const year = new Date().getFullYear();
  const f = t.marketing.footer;

  // בעמודים עצמאיים עוגני הגלילה של דף הבית הופכים למוחלטים כדי שהניווט יעבוד גם מחוץ לדף הבית.
  const hashHref = (hash: string) => (absoluteLinks ? `/${hash}` : hash);

  return (
    <footer className="border-t border-sand-200 bg-sand-100/60 dark:border-sand-800 dark:bg-sand-950">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/torchick-emblem-mark.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                {BRAND.name}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-sand-600 dark:text-sand-400">
              {f.tagline}
            </p>
          </div>

          <nav className="space-y-3">
            <h3 className="text-sm font-bold text-sand-900 dark:text-sand-100">{f.productTitle}</h3>
            <ul className="space-y-2 text-sm text-sand-600 dark:text-sand-400">
              <li>
                <a href={hashHref('#features')} className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {f.links.features}
                </a>
              </li>
              <li>
                <a href={hashHref('#pricing')} className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {f.links.pricing}
                </a>
              </li>
              <li>
                <Link href="/migrate" className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {f.links.migrate}
                </Link>
              </li>
              {demoSlug && (
                <li>
                  <Link
                    href={`/b/${demoSlug}`}
                    className="transition-colors hover:text-brand-700 dark:hover:text-brand-200"
                  >
                    {f.links.demo}
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          <nav className="space-y-3">
            <h3 className="text-sm font-bold text-sand-900 dark:text-sand-100">{f.companyTitle}</h3>
            <ul className="space-y-2 text-sm text-sand-600 dark:text-sand-400">
              <li>
                <Link href="/admin" className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {f.links.admin}
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {f.links.roadmap}
                </Link>
              </li>
              <li>
                <a href={hashHref('#faq')} className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
                  {t.marketing.nav.faq}
                </a>
              </li>
            </ul>
          </nav>

          <nav className="space-y-3">
            <h3 className="text-sm font-bold text-sand-900 dark:text-sand-100">{f.legalTitle}</h3>
            <ul className="space-y-2 text-sm text-sand-600 dark:text-sand-400">
              {LEGAL_LINKS.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    className="transition-colors hover:text-brand-700 dark:hover:text-brand-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-sand-200 pt-8 text-center text-sm text-sand-500 sm:flex-row sm:justify-between sm:text-start dark:border-sand-800">
          <p>
            © {year} {BRAND.name}. {f.rights}
          </p>
          <p className="font-medium text-sand-600 dark:text-sand-400">
            {t.publicPage.creditLine}
          </p>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
