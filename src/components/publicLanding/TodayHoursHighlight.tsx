'use client';

import { useEffect } from 'react';
import { useBusinessDate } from './useBusinessDate';
import { weekdayForDateString } from '@/lib/time';

// שיפור פרוגרסיבי להדגשת "היום" בטבלאות שעות הפעילות.
// עמוד העסק נשמר במטמון כסטטי מלא (revalidate=false), ולכן אסור לצרוב את יום
// השבוע הנוכחי לתוך ה-HTML — אחרת ההדגשה הייתה נתקעת על יום ה-build.
// כל שורת שעות בעמוד נושאת data-hours-day (0=ראשון..6=שבת) ו-data-today-class עם
// מחלקות ההדגשה המדויקות של אותה רשימה. לאחר הטעינה בדפדפן מחשבים את היום ומוסיפים
// את המחלקות רק לשורות התואמות, כך שה-UX נשאר זהה לחלוטין ללא תלות זמן ב-HTML הנשמר.
export default function TodayHoursHighlight({ timeZone = 'Asia/Jerusalem' }: { timeZone?: string }) {
  const date = useBusinessDate(timeZone);
  useEffect(() => {
    if (!date) return;
    const today = weekdayForDateString(date, timeZone);
    const rows = document.querySelectorAll<HTMLElement>(`[data-hours-day="${today}"]`);
    rows.forEach((row) => {
      const cls = row.dataset.todayClass;
      if (cls) row.classList.add(...cls.split(' ').filter(Boolean));
    });
    return () => rows.forEach((row) => {
      const cls = row.dataset.todayClass;
      if (cls) row.classList.remove(...cls.split(' ').filter(Boolean));
    });
  }, [date, timeZone]);
  return null;
}
