import { adminServiceSnapshotSchema, type AdminServiceSnapshot } from './adminServiceSnapshot';
import { serviceCategoriesSchema, type ServiceCategories } from './serviceCategories';

export type AdminFormState = {
  ok: boolean;
  error?: string;
  mode?: 'add' | 'edit';
  scheduled?: boolean;
  service?: AdminServiceSnapshot;
  categories?: ServiceCategories;
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
  if ('service' in value && value.service !== undefined) {
    if (!result.ok || result.mode !== 'edit') throw new Error('Unexpected service confirmation');
    result.service = adminServiceSnapshotSchema.parse(value.service);
  }
  if ('categories' in value && value.categories !== undefined) {
    if (!result.ok) throw new Error('Unexpected category confirmation');
    result.categories = serviceCategoriesSchema.parse(value.categories);
  }
  return result;
}

export function requireSavedService(state: AdminFormState, expectedId: string): AdminServiceSnapshot {
  if (!state.ok || state.mode !== 'edit' || state.service?.id !== expectedId) {
    throw new Error('Missing or mismatched saved service confirmation');
  }
  return state.service;
}
