export type AdminFormState = {
  ok: boolean;
  error?: string;
  mode?: 'add' | 'edit';
  scheduled?: boolean;
};

export function parseAdminFormState(value: unknown): AdminFormState {
  if (!value || typeof value !== 'object' || !('ok' in value) || typeof value.ok !== 'boolean') {
    throw new Error('Invalid admin form response');
  }
  const result: AdminFormState = { ok: value.ok };
  if ('error' in value && value.error !== undefined) {
    if (typeof value.error !== 'string') throw new Error('Invalid admin form error');
    result.error = value.error;
  }
  if ('mode' in value && value.mode !== undefined) {
    if (value.mode !== 'add' && value.mode !== 'edit') throw new Error('Invalid admin form mode');
    result.mode = value.mode;
  }
  if ('scheduled' in value && value.scheduled !== undefined) {
    if (typeof value.scheduled !== 'boolean') throw new Error('Invalid admin form schedule');
    result.scheduled = value.scheduled;
  }
  return result;
}
