'use client';

import { useEffect } from 'react';

/**
 * רישום ה-Service Worker בצד הלקוח. נטען פעם אחת בטעינת האפליקציה.
 * נרשם רק בסביבת ייצור כדי לא להפריע לפיתוח.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* התעלמות משגיאות רישום בשקט */
      });
    };
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
