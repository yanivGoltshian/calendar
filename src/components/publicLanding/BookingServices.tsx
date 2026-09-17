'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import { filterCategoryServices, type ServiceCategory } from '@/lib/serviceCategories';
import ServiceCategoryTabs, { EmptyServiceCategory } from '@/components/ServiceCategoryTabs';
import { ClockIcon } from './icons';
import type { LandingService } from './LandingServices';

export default function BookingServices({
  services, categories, bookHref,
}: { services: LandingService[]; categories: ServiceCategory[]; bookHref: string }) {
  const [categoryId, setCategoryId] = useState('all');
  const visibleServices = filterCategoryServices(services, categories, categoryId);
  return (
    <>
      <ServiceCategoryTabs categories={categories} services={services} selected={categoryId} onSelect={setCategoryId} />
      {visibleServices.length === 0 ? <EmptyServiceCategory onReset={() => setCategoryId('all')} /> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {visibleServices.map(s => (
          <li key={s.id}>
            <Link
              href={`${bookHref}?service=${s.id}`}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--biz-border)] bg-[color:var(--c-surface,#ffffff)] px-4 py-3.5 shadow-sm transition hover:border-[color:var(--biz)] hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--c-ink,#0f172a)]">{s.name}</p>
                {!s.hideDuration ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-[color:var(--c-muted,#64748b)]">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    {formatDuration(s.durationMin)}
                  </p>
                ) : null}
              </div>
              {!s.hidePrice ? (
                <span className="shrink-0 ps-3 font-bold text-[color:var(--biz-ink-strong)]">
                  {formatAgorot(s.priceAgorot)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
