import Link from 'next/link';
import type { ReactNode } from 'react';

import { BRAND } from '@/config/brand';
import { Container } from '@/components/ui';
import { JsonLd } from '@/components/JsonLd';
import { absoluteUrl } from '@/lib/seo';
import {
  LEGAL_INDEX_LABEL,
  LEGAL_INDEX_PATH,
  LEGAL_LINKS,
} from '@/content/legal/links';
import {
  LEGAL_DISCLAIMER_NOTICE,
  LEGAL_UPDATED_ISO,
  LEGAL_UPDATED_LABEL,
} from '@/content/legal/meta';

/**
 * מעטפת מקומית וסטטית למדור המשפטי (‎/legal‎).
 *
 * המדור אינו משתמש ב-Navbar של דף הנחיתה משום שהוא כולל עוגנים פנימיים
 * (כמו ‎#features‎) שאינם רלוונטיים כאן. במקום זאת נבנתה כותרת עליונה
 * וכותרת תחתונה מינימליות, עצמאיות ונטולות תלות בשרת או במסד נתונים.
 */

/** כותרת עליונה מינימלית: מותג עם קישור לדף הבית וקישור חזרה לאתר. */
export function LegalHeader() {
  return (
    <header className="border-b border-sand-200/70 bg-white/80 backdrop-blur dark:border-sand-800/70 dark:bg-sand-950/70">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-sand-900 dark:text-sand-50"
        >
          {BRAND.name}
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-sand-600 transition-colors hover:text-brand-600 dark:text-sand-300 dark:hover:text-brand-300"
        >
          חזרה לאתר
        </Link>
      </Container>
    </header>
  );
}

/** כותרת תחתונה מינימלית עם קישורי המדור המשפטי וזכויות. */
export function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-sand-200/70 bg-white/60 dark:border-sand-800/70 dark:bg-sand-950/60">
      <Container className="flex flex-col gap-4 py-8 text-sm text-sand-600 dark:text-sand-300 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="קישורים משפטיים" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={LEGAL_INDEX_PATH} className="transition-colors hover:text-brand-600 dark:hover:text-brand-300">
            {LEGAL_INDEX_LABEL}
          </Link>
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className="transition-colors hover:text-brand-600 dark:hover:text-brand-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p>
          © {year} {BRAND.name}. כל הזכויות שמורות.
        </p>
      </Container>
    </footer>
  );
}

type Crumb = { label: string; path: string };

/** פירורי לחם חזותיים תואמי RTL. */
function Breadcrumbs({ trail, current }: { trail: Crumb[]; current: string }) {
  return (
    <nav aria-label="מסלול ניווט" className="text-sm text-sand-500 dark:text-sand-400">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-x-2">
            <Link href={crumb.path} className="transition-colors hover:text-brand-600 dark:hover:text-brand-300">
              {crumb.label}
            </Link>
            <span aria-hidden="true" className="text-sand-300 dark:text-sand-600">
              /
            </span>
          </li>
        ))}
        <li aria-current="page" className="font-medium text-sand-700 dark:text-sand-200">
          {current}
        </li>
      </ol>
    </nav>
  );
}

/** הערת אי־ייעוץ משפטי המוצגת בראש כל עמוד. */
function DisclaimerNotice() {
  return (
    <p
      role="note"
      className="mt-6 rounded-2xl border border-sand-200 bg-sand-100/70 px-4 py-3 text-sm leading-relaxed text-sand-600 dark:border-sand-800 dark:bg-sand-900/60 dark:text-sand-300"
    >
      {LEGAL_DISCLAIMER_NOTICE}
    </p>
  );
}

/**
 * מעטפת מאמר משפטי: פירורי לחם, כותרת ראשית, תאריך עדכון, הערת אי־ייעוץ,
 * גוף התוכן, וקישור חזרה לעמוד האינדקס. כוללת JSON-LD של פירורי הלחם.
 */
export function LegalArticle({
  title,
  path,
  lead,
  isIndex = false,
  children,
}: {
  title: string;
  path: string;
  lead?: ReactNode;
  isIndex?: boolean;
  children: ReactNode;
}) {
  const homeCrumb: Crumb = { label: 'דף הבית', path: '/' };
  const trail: Crumb[] = isIndex ? [homeCrumb] : [homeCrumb, { label: LEGAL_INDEX_LABEL, path: LEGAL_INDEX_PATH }];

  const breadcrumbItems = [...trail, { label: title, path }].map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.label,
    item: absoluteUrl(crumb.path),
  }));

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={breadcrumbJsonLd} />
      <article className="mx-auto max-w-3xl">
        <Breadcrumbs trail={trail} current={title} />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-sand-900 dark:text-sand-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-sand-500 dark:text-sand-400">
          עודכן לאחרונה:{' '}
          <time dateTime={LEGAL_UPDATED_ISO} className="font-medium">
            {LEGAL_UPDATED_LABEL}
          </time>
        </p>
        {lead ? (
          <p className="mt-6 text-lg leading-relaxed text-sand-600 dark:text-sand-300">{lead}</p>
        ) : null}
        <DisclaimerNotice />
        <div className="mt-8">{children}</div>
        {!isIndex ? (
          <div className="mt-12 border-t border-sand-200 pt-6 dark:border-sand-800">
            <Link
              href={LEGAL_INDEX_PATH}
              className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
            >
              חזרה למדור המשפטי
            </Link>
          </div>
        ) : null}
      </article>
    </Container>
  );
}
