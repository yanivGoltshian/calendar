import QuoteRequestForm, { type QuoteFormDefaults } from './QuoteRequestForm';
import UpgradeQuoteView from './UpgradeQuoteView';

type Variant = 'page' | 'paywall';

export default function UpgradeQuoteContent({
  variant,
  defaults,
  stateLine,
}: {
  variant: Variant;
  defaults: QuoteFormDefaults;
  stateLine: string;
}) {
  return (
    <UpgradeQuoteView
      variant={variant}
      stateLine={stateLine}
      contactForm={<QuoteRequestForm defaults={defaults} />}
    />
  );
}
