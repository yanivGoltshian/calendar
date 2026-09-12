import { boundedFormData, MediaError } from '@/server/media/uploadPolicy';
import { parseAdminFormState, type AdminFormState } from '@/lib/adminFormState';
import { getCanonicalOrigin } from '@/lib/canonicalHost';

export const ADMIN_FORM_BODY_LIMIT = 9 * 1024 * 1024;

export function createAdminFormPost(
  save: (data: FormData) => Promise<AdminFormState>,
  authorize: () => Promise<boolean>,
  canonicalOrigin: string | null = getCanonicalOrigin(),
) {
  return async function POST(request: Request): Promise<Response> {
    const json = (state: AdminFormState, status: number) => Response.json(parseAdminFormState(state), {
      status, headers: { 'Cache-Control': 'no-store' },
    });
    // Standalone/proxied Next requests can carry an internal URL. Trust the configured
    // canonical origin, never caller-controlled forwarded-host headers.
    if (request.headers.get('origin') !== (canonicalOrigin ?? new URL(request.url).origin)) {
      return json({ ok: false, error: 'forbidden_origin' }, 403);
    }
    if (!await authorize()) return json({ ok: false, error: 'no_business' }, 403);
    if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type') ?? '')) {
      return json({ ok: false, error: 'bad_request' }, 415);
    }
    let data: FormData;
    try {
      data = await boundedFormData(request, ADMIN_FORM_BODY_LIMIT);
    } catch (error) {
      if (error instanceof MediaError) return json({ ok: false, error: 'bad_request' }, error.status);
      if (error instanceof TypeError) return json({ ok: false, error: 'bad_request' }, 400);
      throw error;
    }
    // Route-handler revalidation invalidates the next visit without an action-embedded Flight refresh.
    const state = await save(data);
    return json(state, state.ok ? 200 : 400);
  };
}
