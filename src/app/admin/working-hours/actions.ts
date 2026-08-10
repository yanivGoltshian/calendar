'use server';

import { revalidatePath } from 'next/cache';
import { getFirstBusiness } from '@/server/repos/business';
import {
  setBusinessHours,
  setStaffHours,
  type WorkingHoursRow,
} from '@/server/repos/workingHours';

export type SaveWorkingHoursState = {
  ok: boolean;
  error?: 'range' | 'break' | 'noStaff' | 'generic';
};

/** המרת "HH:MM" לדקות מתחילת היום. מחזיר null כשהקלט ריק או לא תקין. */
function parseHHMM(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** שמירת שעות עבודה לעסק או לאיש צוות (חתימת useActionState). */
export async function saveWorkingHoursAction(
  _prev: SaveWorkingHoursState,
  formData: FormData,
): Promise<SaveWorkingHoursState> {
  const business = await getFirstBusiness();
  if (!business) return { ok: false, error: 'generic' };

  const staffId = String(formData.get('staffId') ?? '').trim() || null;

  const rows: WorkingHoursRow[] = [];

  for (let d = 0; d < 7; d++) {
    const open = formData.get(`open_${d}`) === 'on';
    if (!open) continue;

    const start = parseHHMM(formData.get(`start_${d}`));
    const end = parseHHMM(formData.get(`end_${d}`));
    if (start === null || end === null || end <= start) {
      return { ok: false, error: 'range' };
    }

    const breakStart = parseHHMM(formData.get(`breakStart_${d}`));
    const breakEnd = parseHHMM(formData.get(`breakEnd_${d}`));
    const breaks: [number, number][] = [];

    // הפסקה נחשבת רק כששני השדות מולאו.
    if (breakStart !== null || breakEnd !== null) {
      if (
        breakStart === null ||
        breakEnd === null ||
        breakEnd <= breakStart ||
        breakStart < start ||
        breakEnd > end
      ) {
        return { ok: false, error: 'break' };
      }
      breaks.push([breakStart, breakEnd]);
    }

    rows.push({ weekday: d, startMinute: start, endMinute: end, breaks });
  }

  try {
    if (staffId) {
      const ok = await setStaffHours(business.id, staffId, rows);
      if (!ok) return { ok: false, error: 'noStaff' };
    } else {
      await setBusinessHours(business.id, rows);
    }
  } catch {
    return { ok: false, error: 'generic' };
  }

  revalidatePath('/admin/working-hours');
  return { ok: true };
}
