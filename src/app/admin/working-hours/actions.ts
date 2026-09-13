'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import {
  setBusinessHours,
  setStaffHours,
  type WorkingHoursRow,
} from '@/server/repos/workingHours';
import {
  WorkingHoursValidationError,
  type WorkingHoursErrorCode,
} from '@/lib/workingHours';
import { parseWorkingHoursForm } from '@/lib/workingHoursForm';

export type SaveWorkingHoursState = {
  ok: boolean;
  error?: WorkingHoursErrorCode | 'noStaff' | 'generic';
};

/** שמירת שעות עבודה לעסק או לאיש צוות (חתימת useActionState). */
export async function saveWorkingHoursAction(
  _prev: SaveWorkingHoursState,
  formData: FormData,
): Promise<SaveWorkingHoursState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  const staffId = String(formData.get('staffId') ?? '').trim() || null;

  let rows: WorkingHoursRow[];
  try {
    rows = parseWorkingHoursForm(formData);
  } catch (error) {
    if (error instanceof WorkingHoursValidationError) {
      return { ok: false, error: error.code };
    }
    throw error;
  }

  if (staffId) {
    const ok = await setStaffHours(business.id, staffId, rows);
    if (!ok) return { ok: false, error: 'noStaff' };
  } else {
    await setBusinessHours(business.id, rows);
  }

  revalidatePath('/admin/working-hours');
  // רענון עמודי הציבור: שעות הפעילות מוצגות בעמוד העסק (שעות + JSON-LD) ומשפיעות על
  // חישוב הזמינות בעמוד ההזמנה, ולכן משנות תוכן ציבורי שנשמר סטטית (revalidate=false).
  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/b/${business.slug}/book`);
  return { ok: true };
}
