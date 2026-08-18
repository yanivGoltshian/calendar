import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveStaffWorkingHours,
  type EffectiveHoursRow,
  type WorkingHoursClient,
} from './workingHours';
import { computeSlots, type WorkingHoursInput } from '@/server/availability';
import { weekdayForDateString } from '@/lib/time';

/**
 * בדיקות רגרסיה ל-getEffectiveStaffWorkingHours:
 * הבאג המקורי — הזמינות נגזרה משעות ברמת STAFF בלבד, ללא נפילה לשעות העסק,
 * ולכן איש צוות חדש (ללא שעות ייעודיות) היה חסר משבצות ולא ניתן להזמנה.
 */

const TZ = 'Asia/Jerusalem';
const DATE = '2026-06-15';

/** לקוח Prisma מזויף שמחזיר שורות שונות לפי ה-scope, וסופר את הקריאות. */
function makeFakeClient(opts: {
  staff: EffectiveHoursRow[];
  business: EffectiveHoursRow[];
}): { client: WorkingHoursClient; calls: { scope: string; staffId?: string; businessId?: string }[] } {
  const calls: { scope: string; staffId?: string; businessId?: string }[] = [];
  const client: WorkingHoursClient = {
    workingHours: {
      async findMany(args) {
        calls.push({ ...args.where });
        return args.where.scope === 'STAFF' ? opts.staff : opts.business;
      },
    },
  };
  return { client, calls };
}

function row(weekday: number, startMinute: number, endMinute: number): EffectiveHoursRow {
  return { weekday, startMinute, endMinute, breaks: [] };
}

test('רגרסיה: אין שעות STAFF אך יש שעות BUSINESS → נפילה לשעות העסק', async () => {
  const weekday = weekdayForDateString(DATE, TZ);
  const businessRows = [row(weekday, 9 * 60, 17 * 60)];
  const { client, calls } = makeFakeClient({ staff: [], business: businessRows });

  const effective = await getEffectiveStaffWorkingHours('biz-1', 'staff-1', client);

  // נפילה נכונה לשעות העסק.
  assert.deepEqual(effective, businessRows);
  // נשאלו שתי השאילתות: תחילה STAFF ואז BUSINESS.
  assert.equal(calls.length, 2);
  assert.equal(calls[0].scope, 'STAFF');
  assert.equal(calls[0].staffId, 'staff-1');
  assert.equal(calls[1].scope, 'BUSINESS');
  assert.equal(calls[1].businessId, 'biz-1');

  // הוכחת "ניתן להזמנה": המשבצות שנגזרות מהשעות שנפלו אינן ריקות.
  const workingHours: WorkingHoursInput[] = effective.map((r) => ({
    weekday: r.weekday,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    breaks: [],
  }));
  const slots = computeSlots({
    dateStr: DATE,
    workingHours,
    busy: [],
    durationMin: 30,
    slotGranularityMin: 15,
    timeZone: TZ,
    now: new Date('2020-01-01T00:00:00Z'),
  });
  assert.ok(slots.length > 0, 'ציפינו למשבצות זמינות לאחר הנפילה לשעות העסק');
  assert.equal(slots[0].label, '09:00');
});

test('כאשר יש שעות STAFF — משתמשים בהן ולא ניגשים לשעות העסק', async () => {
  const weekday = weekdayForDateString(DATE, TZ);
  const staffRows = [row(weekday, 10 * 60, 14 * 60)];
  const businessRows = [row(weekday, 9 * 60, 17 * 60)];
  const { client, calls } = makeFakeClient({ staff: staffRows, business: businessRows });

  const effective = await getEffectiveStaffWorkingHours('biz-1', 'staff-1', client);

  assert.deepEqual(effective, staffRows);
  // רק שאילתת STAFF בוצעה — אין override של שעות איש הצוות.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scope, 'STAFF');
});

test('אין שעות STAFF ואין שעות BUSINESS → מחזיר [] (נשאר לא זמין)', async () => {
  const { client, calls } = makeFakeClient({ staff: [], business: [] });

  const effective = await getEffectiveStaffWorkingHours('biz-1', 'staff-1', client);

  assert.deepEqual(effective, []);
  assert.equal(calls.length, 2);
});
