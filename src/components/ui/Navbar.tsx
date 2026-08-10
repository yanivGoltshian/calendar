'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Container } from './Container';

type NavLink = { href: string; label: string };

const sectionLinks: NavLink[] = [
  { href: '#features', label: t.marketing.nav.features },
  { href: '#audiences', label: t.marketing.nav.audiences },
  { href: '#how-it-works', label: t.marketing.nav.howItWorks },
  { href: '#pricing', label: t.marketing.nav.pricing },
  { href: '#faq', label: t.marketing.nav.faq },
];

/** Navbar — כותרת עליונה דביקה, אלגנטית, עם CTA וקישורי שער לניהול ולעמוד לדוגמה. */
export function Navbar({ demoSlug }: { demoSlug?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-sand-200/70 bg-sand-50/85 backdrop-blur-lg dark:border-sand-800/70 dark:bg-sand-950/80'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-16 items-center justify-between sm:h-18">
        <Link href="/" className="flex items-center gap-2" aria-label={BRAND.name}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-glow-soft">
            {BRAND.name.charAt(0)}
          </span>
          <span className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
            {BRAND.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-sand-600 transition-colors hover:bg-sand-100 hover:text-sand-900 dark:text-sand-300 dark:hover:bg-sand-800 dark:hover:text-sand-50"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/admin"
            className="text-sm font-medium text-sand-600 transition-colors hover:text-brand-700 dark:text-sand-300 dark:hover:text-brand-200"
          >
            {t.marketing.nav.login}
          </Link>
          <Button href="/admin" size="sm">
            {t.marketing.nav.cta}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl text-sand-700 transition-colors hover:bg-sand-100 lg:hidden dark:text-sand-200 dark:hover:bg-sand-800"
          aria-label={open ? t.marketing.nav.closeMenu : t.marketing.nav.openMenu}
          aria-expanded={open}
        >
          <span className="relative block h-4 w-5">
            <span
              className={cn(
                'absolute inset-x-0 top-0 h-0.5 rounded-full bg-current transition-all duration-300',
                open && 'top-1.5 rotate-45',
              )}
            />
            <span
              className={cn(
                'absolute inset-x-0 top-1.5 h-0.5 rounded-full bg-current transition-all duration-300',
                open && 'opacity-0',
              )}
            />
            <span
              className={cn(
                'absolute inset-x-0 top-3 h-0.5 rounded-full bg-current transition-all duration-300',
                open && 'top-1.5 -rotate-45',
              )}
            />
          </span>
        </button>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-sand-200/70 bg-sand-50/95 backdrop-blur-lg lg:hidden dark:border-sand-800/70 dark:bg-sand-950/95"
          >
            <Container className="flex flex-col gap-1 py-4">
              {sectionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-sand-700 transition-colors hover:bg-sand-100 dark:text-sand-200 dark:hover:bg-sand-800"
                >
                  {link.label}
                </a>
              ))}
              {demoSlug && (
                <a
                  href={`/b/${demoSlug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-sand-700 transition-colors hover:bg-sand-100 dark:text-sand-200 dark:hover:bg-sand-800"
                >
                  {t.marketing.nav.demo}
                </a>
              )}
              <div className="mt-3 flex flex-col gap-2 border-t border-sand-200/70 pt-4 dark:border-sand-800/70">
                <Button href="/admin" variant="secondary" size="md" onClick={() => setOpen(false)}>
                  {t.marketing.nav.login}
                </Button>
                <Button href="/admin" size="md" onClick={() => setOpen(false)}>
                  {t.marketing.nav.cta}
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
