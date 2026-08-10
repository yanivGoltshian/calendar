import type { ReactNode } from 'react';

import { LegalFooter, LegalHeader } from './_components/legal-shell';

/**
 * פריסת המדור המשפטי: כותרת עליונה וכותרת תחתונה מינימליות סביב תוכן העמוד.
 * הפריסה סטטית לחלוטין ואינה תלויה בשרת פעיל או במסד נתונים.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 dark:bg-sand-950 dark:text-sand-50">
      <LegalHeader />
      <main className="flex-1">{children}</main>
      <LegalFooter />
    </div>
  );
}
