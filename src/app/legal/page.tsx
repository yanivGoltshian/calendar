import Link from 'next/link';

import { buildMetadata } from '@/lib/seo';
import { LEGAL_INDEX_LABEL, LEGAL_INDEX_PATH, LEGAL_LINKS } from '@/content/legal/links';

import { LegalArticle } from './_components/legal-shell';

export const dynamic = 'force-static';

export const metadata = buildMetadata({
  title: 'מידע משפטי',
  description:
    'מרכז המידע המשפטי של השירות: תקנון ותנאי שימוש, מדיניות פרטיות והצהרת נגישות. כאן תמצאו את המסמכים המסדירים את השימוש בפלטפורמה.',
  path: LEGAL_INDEX_PATH,
});

export default function LegalIndexPage() {
  return (
    <LegalArticle
      title={LEGAL_INDEX_LABEL}
      path={LEGAL_INDEX_PATH}
      isIndex
      lead="ריכזנו כאן את המסמכים המשפטיים של השירות. הם מסבירים את הכללים לשימוש בפלטפורמה, את האופן שבו אנו מגנים על המידע שלכם, ואת מחויבותנו לנגישות."
    >
      <ul className="grid gap-4 sm:grid-cols-1">
        {LEGAL_LINKS.map((link) => (
          <li key={link.path}>
            <Link
              href={link.path}
              className="group block rounded-3xl border border-sand-200 bg-white p-6 shadow-soft transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-sand-800 dark:bg-sand-900/60 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
            >
              <h2 className="font-display text-xl font-bold text-sand-900 transition-colors group-hover:text-brand-700 dark:text-sand-50 dark:group-hover:text-brand-300">
                {link.label}
              </h2>
              <p className="mt-2 leading-relaxed text-sand-600 dark:text-sand-300">{link.description}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-brand-600 dark:text-brand-300">
                למעבר למסמך
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </LegalArticle>
  );
}
