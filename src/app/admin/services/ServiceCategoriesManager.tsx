'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n';
import { parseAdminFormState } from '@/lib/adminFormState';
import {
  setServiceCategory,
  type ServiceCategories,
  type ServiceCategory,
} from '@/lib/serviceCategories';

type Props = {
  initial: ServiceCategories;
  services: { id: string; name: string }[];
  onboarding?: boolean;
  onSaved?: (config: ServiceCategories) => void;
};

export default function ServiceCategoriesManager({ initial, services, onboarding, onSaved }: Props) {
  const text = t.serviceCategories;
  const router = useRouter();
  const fieldId = useId();
  const [saved, setSaved] = useState(initial);
  const config = initial.revision > saved.revision ? initial : saved;
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => setHydrated(true), []);

  async function save(next: ServiceCategories) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const data = new FormData();
      const available = new Set(services.map(service => service.id));
      data.set('categories', JSON.stringify({
        ...next,
        categories: next.categories.map(category => ({
          ...category, serviceIds: category.serviceIds.filter(id => available.has(id)),
        })),
      }));
      const response = await fetch('/api/admin/service-categories', {
        method: 'POST', body: data, signal: AbortSignal.timeout(30_000),
      });
      const result = parseAdminFormState(await response.json());
      if (!result.ok) {
        setError(result.error ?? 'generic');
        return;
      }
      if (!response.ok || !result.categories || result.categories.revision !== next.revision + 1) {
        throw new Error('Missing category save confirmation');
      }
      setSaved(result.categories);
      onSaved?.(result.categories);
      setEditing(null);
      setSuccess(true);
      router.refresh();
    } catch (error) {
      console.error('service_categories_save_unconfirmed', error instanceof Error ? error.name : 'unknown');
      setError('unconfirmed');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const busy = pending || !hydrated;
  return (
    <details className="my-5 rounded-2xl border border-[#e7ddcd] bg-white p-4" data-service-categories data-hydrated={hydrated}>
      <summary className="cursor-pointer text-sm font-semibold text-[#6e655f]">{text.advanced}</summary>
      <div className="mt-4 space-y-4">
        <label className="flex items-center gap-3 text-sm font-semibold text-[#1b1715]">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={busy || editing !== null}
            onChange={event => void save({ ...config, enabled: event.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          {text.enable}
        </label>
        <p className="text-xs leading-relaxed text-[#8f8478]">{text.optional}</p>
        {onboarding ? <p className="text-xs text-[#8f8478]">{text.onboardingHint}</p> : null}
        {error ? (
          <div role="alert" className="text-sm text-red-700">
            <p>{error === 'conflict' ? text.conflict : error === 'invalid_service' ? text.invalidService
              : error === 'unconfirmed' ? t.common.saveUnconfirmed : text.error}</p>
            {error === 'conflict' || error === 'invalid_service' || error === 'unconfirmed' ? (
              <button type="button" className="mt-2 underline" onClick={() => {
                setEditing(null);
                setError(null);
                router.refresh();
              }}>{text.reload}</button>
            ) : null}
          </div>
        ) : null}
        {success ? <p role="status" className="text-sm text-emerald-700">{text.saved}</p> : null}
        {config.enabled ? (
          <>
            <ul className="space-y-2">
              {config.categories.map(category => (
                <li key={category.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] p-3">
                  <span className="min-w-0 break-words text-sm font-semibold text-[#1b1715]">
                    {category.name}
                    <span className="ms-2 text-xs font-normal text-[#8f8478]">
                      {category.serviceIds.filter(id => services.some(service => service.id === id)).length} {text.services}
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button type="button" disabled={busy || !!editing} className="font-semibold text-emerald-700 disabled:opacity-50" onClick={() => {
                      setSuccess(false);
                      setEditing({ ...category, serviceIds: category.serviceIds.filter(id => services.some(service => service.id === id)) });
                    }}>{text.edit}</button>
                    <button type="button" disabled={busy || !!editing} className="text-[#8f8478] disabled:opacity-50" onClick={() => {
                      if (window.confirm(text.deleteConfirm)) {
                        void save({ ...config, categories: config.categories.filter(item => item.id !== category.id) });
                      }
                    }}>{text.remove}</button>
                  </div>
                </li>
              ))}
            </ul>
            {editing ? (
              <form aria-label={text.editor} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" onSubmit={event => {
                event.preventDefault();
                void save(setServiceCategory(config, { ...editing, name: editing.name.trim() }));
              }}>
                <label htmlFor={fieldId} className="block text-sm font-semibold">{text.name}</label>
                <input
                  id={fieldId}
                  autoFocus
                  required
                  maxLength={80}
                  value={editing.name}
                  disabled={busy}
                  onChange={event => setEditing({ ...editing, name: event.target.value })}
                  className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2 text-sm"
                />
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">{text.membership}</legend>
                  <p className="text-xs text-[#8f8478]">{text.singleCategory}</p>
                  {services.map(service => (
                    <label key={service.id} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.serviceIds.includes(service.id)}
                        onChange={event => setEditing({ ...editing, serviceIds: event.target.checked
                          ? [...editing.serviceIds, service.id]
                          : editing.serviceIds.filter(id => id !== service.id) })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      {service.name}
                    </label>
                  ))}
                </fieldset>
                <div className="flex gap-3">
                  <button type="submit" disabled={busy || !editing.name.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {pending ? text.saving : text.save}
                  </button>
                  <button type="button" disabled={busy} className="text-sm text-[#6e655f]" onClick={() => setEditing(null)}>{text.cancel}</button>
                </div>
              </form>
            ) : (
              <button type="button" disabled={busy} className="text-sm font-semibold text-emerald-700 disabled:opacity-50" onClick={() => {
                setSuccess(false);
                setEditing({ id: crypto.randomUUID(), name: '', serviceIds: [] });
              }}>+ {text.add}</button>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
