'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseAdminFormState, type AdminFormState } from '@/lib/adminFormState';

type FormKind = 'settings' | 'services' | 'campaigns' | 'hours-exceptions' | 'hours-exceptions/delete';

export function useAdminForm(kind: FormKind, initial: AdminFormState) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const flash = url.searchParams.get('_saved');
    const result: AdminFormState | null =
      kind === 'services' && (flash === 'service-add' || flash === 'service-edit')
        ? { ok: true, mode: flash === 'service-add' ? 'add' : 'edit' }
        : kind === 'campaigns' && (flash === 'campaign-scheduled' || flash === 'campaign-draft')
          ? { ok: true, scheduled: flash === 'campaign-scheduled' }
          : kind === 'hours-exceptions' && (flash === 'hours-exception-saved' || flash === 'hours-exception-deleted')
            ? { ok: true }
            : null;
    if (!result) return;
    setState(result);
    url.searchParams.delete('_saved');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [kind]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    let navigating = false;
    try {
      const response = await fetch(`/api/admin/${kind}`, {
        method: 'POST', body: data, signal: AbortSignal.timeout(30_000),
      });
      const result = parseAdminFormState(await response.json());
      if (result.ok !== response.ok || (result.ok && kind === 'services' && !result.mode) ||
        (result.ok && kind === 'campaigns' && result.scheduled === undefined)) {
        throw new Error('Inconsistent admin form response');
      }
      setState(result);
      if (result.ok && kind !== 'settings') {
        const url = new URL(window.location.href);
        url.searchParams.set('_saved', kind === 'services' ? `service-${result.mode}` :
          kind === 'campaigns' ? result.scheduled ? 'campaign-scheduled' : 'campaign-draft' :
            kind === 'hours-exceptions' ? 'hours-exception-saved' : 'hours-exception-deleted');
        navigating = true;
        window.location.replace(url.href);
      }
    } catch (error) {
      console.error('admin_form_response_unconfirmed', kind, error instanceof Error ? error.name : 'unknown');
      setState({ ...initial, ok: false, error: 'unconfirmed' });
    } finally {
      if (!navigating) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  return { state, onSubmit, pending };
}
