'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/i18n';
import { newerServiceSnapshot, type AdminServiceSnapshot } from '@/lib/adminServiceSnapshot';
import { agorotToShekels, formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import ServiceForm, { type ServiceFormProps } from './ServiceForm';
import { deleteServiceAction, toggleServiceHiddenAction } from './actions';

export function ServiceEditLink({ id }: { id: string }) {
  const href = `/admin/services?edit=${encodeURIComponent(id)}`;
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      data-service-edit
      onNavigate={(event) => {
        event.preventDefault();
        window.history.pushState(null, '', href);
      }}
      className="rounded-lg border border-[#e7ddcd] px-3 py-1.5 text-sm font-medium text-[#4a4038] transition hover:bg-[#f7f2ea]"
    >
      {t.admin.services.edit}
    </Link>
  );
}

export default function ServiceCard({
  initial,
  staffOptions,
}: Pick<ServiceFormProps, 'staffOptions'> & {
  initial: AdminServiceSnapshot;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const wasEditing = useRef(false);
  const mounted = useRef(true);
  const [confirmed, setConfirmed] = useState<AdminServiceSnapshot | null>(null);
  const service = newerServiceSnapshot(initial, confirmed);
  const searchParams = useSearchParams();
  const isEditing = searchParams.get('edit') === service.id;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (isEditing) {
      ref.current
        ?.querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus({ preventScroll: true });
    } else if (
      wasEditing.current &&
      !new URL(window.location.href).searchParams.has('edit')
    ) {
      ref.current
        ?.querySelector<HTMLAnchorElement>('[data-service-edit]')
        ?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  return (
    <li
      ref={ref}
      data-service-id={service.id}
      className="scroll-mb-24 scroll-mt-24 rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
    >
      {isEditing ? (
        <ServiceForm
          key={service.id}
          initial={{ ...service, priceShekels: agorotToShekels(service.priceAgorot) }}
          staffOptions={staffOptions}
          selectedStaffIds={service.staff.map(member => member.id)}
          onSaved={(saved, closeEditor) => {
            if (!mounted.current) return;
            setConfirmed(current => newerServiceSnapshot(saved, current));
            if (closeEditor && new URL(window.location.href).searchParams.get('edit') === saved.id) {
              window.history.replaceState(null, '', '/admin/services');
            }
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-[#1b1715]">
                {service.name}
                {service.hidden ? (
                  <span className="rounded-full bg-[#e7ddcd] px-2 py-0.5 text-xs font-medium text-[#6e655f]">
                    {t.admin.services.hiddenBadge}
                  </span>
                ) : null}
              </p>
              {service.description ? (
                <p className="mt-0.5 truncate text-sm text-[#8f8478]">
                  {service.description}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-[#6e655f]">
                {service.hideDuration
                  ? t.admin.services.durationHidden
                  : formatDuration(service.durationMin)}
                <span className="mx-1 text-[#d6c8b4]">·</span>
                {service.hidePrice
                  ? t.admin.services.priceHidden
                  : formatAgorot(service.priceAgorot)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#8f8478]">
                <span>{t.admin.services.staffBadgePrefix}</span>
                {service.staff.length === 0 ? (
                  <span className="rounded-full bg-[#efe6d8] px-2 py-0.5 text-[#8f8478]">
                    {t.admin.services.staffNoneBadge}
                  </span>
                ) : service.staff.map(member => (
                  <span key={member.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
                    {member.displayName}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[#efe6d8] pt-3">
            <ServiceEditLink id={service.id} />
            <form action={toggleServiceHiddenAction}>
              <input type="hidden" name="id" value={service.id} />
              <input type="hidden" name="hidden" value={service.hidden ? '0' : '1'} />
              <button
                type="submit"
                className="rounded-lg border border-[#e7ddcd] px-3 py-1.5 text-sm font-medium text-[#4a4038] transition hover:bg-[#f7f2ea]"
              >
                {service.hidden ? t.admin.services.show : t.admin.services.hide}
              </button>
            </form>
            {service.inUse ? (
              <span className="rounded-lg px-3 py-1.5 text-sm text-[#b3a690]">
                {t.admin.services.inUse}
              </span>
            ) : (
              <form action={deleteServiceAction}>
                <input type="hidden" name="id" value={service.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                  {t.admin.services.delete}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </li>
  );
}
