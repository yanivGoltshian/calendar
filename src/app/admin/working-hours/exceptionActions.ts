'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import { createHoursException, deleteHoursException, HoursExceptionError } from '@/server/repos/workingHoursExceptions';

export type ExceptionActionState = {
  ok: boolean; error?: 'forbidden' | 'invalid' | 'staff' | 'limit' | 'missing';
};

function dateInput(form: FormData, prefix: string) {
  return form.get('calendar') === 'HEBREW' ? {
    calendar: 'HEBREW', year: Number(form.get(`${prefix}Year`)),
    month: String(form.get(`${prefix}Month`) ?? ''), day: Number(form.get(`${prefix}Day`)),
  } : { calendar: String(form.get('calendar') ?? ''), date: String(form.get(`${prefix}Date`) ?? '') };
}

function minute(value: FormDataEntryValue | null): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}

function refresh(slug: string) {
  revalidatePath('/admin/working-hours');
  revalidatePath('/admin');
  revalidatePath(`/b/${slug}/book`);
}

export async function saveHoursExceptionAction(
  _state: ExceptionActionState, form: FormData,
): Promise<ExceptionActionState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'forbidden' };
  const closed = form.get('closed') === 'on';
  try {
    await createHoursException(business.id, {
      title: form.get('title'), staffId: form.get('staffId') || null,
      start: dateInput(form, 'start'),
      ...(form.get('range') === 'on' ? { end: dateInput(form, 'end') } : {}),
      recurrence: form.get('recurrence'),
      intervalWeeks: Number(form.get('intervalWeeks') ?? 1),
      until: form.get('until') || null,
      closed, startMinute: closed ? null : minute(form.get('startTime')),
      endMinute: closed ? null : form.get('endTime') === '24:00' ? 1440 : minute(form.get('endTime')),
    });
  } catch (error) {
    if (error instanceof HoursExceptionError) return { ok: false, error: error.code };
    throw error;
  }
  refresh(business.slug);
  return { ok: true };
}

export async function deleteHoursExceptionAction(
  _state: ExceptionActionState, form: FormData,
): Promise<ExceptionActionState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'forbidden' };
  const id = form.get('id');
  if (typeof id !== 'string' || !id || id.length > 100) return { ok: false, error: 'invalid' };
  try {
    await deleteHoursException(business.id, id);
  } catch (error) {
    if (error instanceof HoursExceptionError) return { ok: false, error: error.code };
    throw error;
  }
  refresh(business.slug);
  return { ok: true };
}
