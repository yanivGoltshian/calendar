'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

type FaqItem = { q: string; a: string };

/**
 * FaqAccordion — אקורדיון שאלות נפוצות, נגיש ומונפש בעדינות.
 * מכבד prefers-reduced-motion.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto max-w-3xl divide-y divide-sand-200 overflow-hidden rounded-4xl border border-sand-200 bg-white/80 dark:divide-sand-800 dark:border-sand-800 dark:bg-sand-800/60">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start transition-colors hover:bg-sand-50/70 dark:hover:bg-sand-900/40"
            >
              <span className="text-base font-semibold text-sand-900 dark:text-sand-50 sm:text-lg">
                {item.q}
              </span>
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-300 dark:bg-brand-950/50 dark:text-brand-200',
                  isOpen && 'rotate-45',
                )}
                aria-hidden
              >
                +
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 leading-relaxed text-sand-600 dark:text-sand-300">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default FaqAccordion;
