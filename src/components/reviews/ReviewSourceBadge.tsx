import Image from 'next/image';
import { t } from '@/i18n';

export type ReviewDisplaySource = 'google' | 'torchick' | 'unknown';

export default function ReviewSourceBadge({ source }: { source: ReviewDisplaySource }) {
  return (
    <span
      data-review-source={source}
      className="inline-flex shrink-0 items-center gap-1.5 text-xs leading-5 text-[color:var(--c-muted,#665d57)]"
    >
      {source === 'google' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="block h-5 w-5 shrink-0">
          <path
            fill="#4285F4"
            d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.1h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-1 6.7-2.5l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3a10 10 0 0 0 0 8.8l3.4-2.6Z"
          />
          <path
            fill="#EA4335"
            d="M12 6.1c1.5 0 2.7.5 3.7 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-9 5.6l3.4 2.6C7.2 7.9 9.4 6.1 12 6.1Z"
          />
        </svg>
      ) : source === 'torchick' ? (
        <Image
          src="/brand/torchick-emblem-mark.png"
          width={20}
          height={20}
          alt=""
          className="block h-5 w-5 shrink-0 object-contain"
        />
      ) : null}
      <span className="block leading-5">
        {source === 'google'
          ? t.reviews.sourceGoogle
          : source === 'torchick'
            ? t.reviews.sourcePlatform
            : t.reviews.sourceUnknown}
      </span>
    </span>
  );
}
