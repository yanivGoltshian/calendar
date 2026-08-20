import type { Metadata } from 'next';
import { t } from '@/i18n';
import UpgradeQuote from './UpgradeQuote';

export const metadata: Metadata = {
  title: t.quote.page.title,
};

/**
 * עמוד השדרוג ובקשת הצעת המחיר באזור הניהול (D4).
 * מציג את הרכיב המשותף UpgradeQuote בגרסת עמוד מלא.
 */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <main dir="rtl" className="mx-auto w-full max-w-3xl px-4 py-8">
      <UpgradeQuote variant="page" defaultPlan={params.plan} />
    </main>
  );
}
