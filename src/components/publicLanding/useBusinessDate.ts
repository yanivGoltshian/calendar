'use client';

import { useEffect, useState } from 'react';
import { businessDate, nextBusinessMidnight } from '@/lib/businessDate';

/** Empty on SSR and first hydration; update at business midnight and after sleep. */
export function useBusinessDate(timeZone = 'Asia/Jerusalem'): string {
  const [date, setDate] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setDate(businessDate(now, timeZone));
      timer = setTimeout(update, Math.max(1000, nextBusinessMidnight(now, timeZone).getTime() - now.getTime() + 50));
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [timeZone]);
  return date;
}
