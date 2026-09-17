'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import Modal from '@/components/ui/admin/Modal';
import {
  reviewSubmissionContextSchema,
  type ReviewSubmissionContext,
} from '@/lib/businessReviews';
import ReviewSubmissionContent from './ReviewSubmissionContent';

export default function ReviewSubmissionDialog({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ReviewSubmissionContext | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const slug = decodeURIComponent(href.split('/')[2]);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    setContext(null);
    setError(false);
    void (async () => {
      try {
        const response = await fetch(
          `/api/public/b/${encodeURIComponent(slug)}/reviews/eligibility`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error('Review eligibility request failed');
        const result = reviewSubmissionContextSchema.parse(await response.json());
        if (active) setContext(result);
      } catch (cause) {
        if (active) {
          console.error(
            'review_eligibility_unavailable',
            cause instanceof Error ? cause.name : 'unknown',
          );
          setError(true);
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, slug, attempt]);
  return (
    <>
      <a
        href={href}
        data-review-dialog-trigger
        data-hydrated={hydrated}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setContext(null);
          setError(false);
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center rounded-lg border border-[color:var(--c-border,#e2e8f0)] px-3 text-xs font-semibold text-[color:var(--biz-text,#334155)]"
      >
        {t.reviews.write}
      </a>
      <Modal open={open} onClose={close} title={t.reviews.customerTitle} variant="public">
        <p className="mb-4 text-sm text-slate-600">{t.reviews.customerIntro}</p>
        {error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-700">
              {t.reviews.loadError}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="min-h-11 rounded-lg border border-slate-300 px-3"
            >
              {t.reviews.retry}
            </button>
          </div>
        ) : context ? (
          <ReviewSubmissionContent slug={slug} context={context} onClose={close} />
        ) : (
          <p role="status">{t.common.loading}</p>
        )}
      </Modal>
    </>
  );
}
