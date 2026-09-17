'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import type { SectionIconKey } from '@/lib/publicPageStyle';
import { SectionIcon, ClockIcon, ArrowLeftIcon } from './icons';
import SectionHeading from './SectionHeading';
import ServiceCategoryTabs, { EmptyServiceCategory } from '@/components/ServiceCategoryTabs';
import { filterCategoryServices, type ServiceCategory } from '@/lib/serviceCategories';

export type LandingService = {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  priceAgorot: number;
  hidePrice?: boolean;
  hideDuration?: boolean;
};

type Props = {
  title: string;
  services: LandingService[];
  categories?: ServiceCategory[];
  bookHref: string;
  iconKey: SectionIconKey;
  bookLabel: string;
  eyebrow?: string;
};

// מקטע השירותים — קלפים אלגנטיים; כל קלף מקשר ישירות לזרימת קביעת התור הקיימת.
// עוגן lp-services מאפשר גלילה חלקה מכפתור המשני שבהירו.
export default function LandingServices({ title, services, categories = [], bookHref, iconKey, bookLabel, eyebrow }: Props) {
  const [categoryId, setCategoryId] = useState('all');
  const visibleServices = filterCategoryServices(services, categories, categoryId);
  if (services.length === 0) return null;
  return (
    <section id="lp-services" data-palette-surface="services" className="mt-16 scroll-mt-24 sm:mt-24">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        icon={<SectionIcon iconKey={iconKey} className="h-4 w-4" />}
      />
      <div className="mx-auto mt-10 flex max-w-[940px] flex-col gap-3.5">
        <ServiceCategoryTabs categories={categories} services={services} selected={categoryId} onSelect={setCategoryId} />
        {visibleServices.length === 0 ? <EmptyServiceCategory onReset={() => setCategoryId('all')} /> : null}
        {visibleServices.map((s) => (
          <Link
            key={s.id}
            href={`${bookHref}?service=${s.id}`}
            className="group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-[color:var(--biz-border)] bg-[color:var(--c-surface,#ffffff)] px-5 py-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated sm:px-6"
          >
            <div className="min-w-[210px] flex-1">
              <h3 className="font-display text-[1.08rem] font-extrabold leading-snug text-[color:var(--c-ink,#0f172a)] sm:text-lg">
                {s.name}
              </h3>
              {s.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[color:var(--c-muted,#64748b)]">{s.description}</p>
              ) : null}
            </div>
            {!s.hideDuration ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-[color:var(--c-muted,#64748b)]">
                <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                {formatDuration(s.durationMin)}
              </span>
            ) : null}
            {!s.hidePrice ? (
              <span className="min-w-[76px] text-center font-display text-lg font-black text-[color:var(--biz-text,#334155)]">
                {formatAgorot(s.priceAgorot)}
              </span>
            ) : null}
            <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] px-5 py-2.5 text-sm font-extrabold text-[color:var(--biz-text,#334155)] transition group-hover:bg-[var(--biz)] group-hover:text-[color:var(--biz-ink)] max-[560px]:w-full">
              {bookLabel}
              <ArrowLeftIcon className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
