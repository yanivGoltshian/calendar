'use client';

import { useEffect, useState } from 'react';

/**
 * כפתור הצטרפות ל-Web Push עבור בעל העסק.
 *
 * הכפתור מבקש הרשאת התראות מהדפדפן, מוודא שה-Service Worker רשום (ורושם אותו
 * במפורש אם לא, כדי לתמוך גם בסביבת פיתוח שבה הרישום האוטומטי מושבת), יוצר מנוי
 * PushManager עם מפתח ה-VAPID הציבורי, ושולח אותו ל-/api/push/subscribe.
 *
 * הכול best-effort: כל כשל מוצג כהודעת מצב בעברית ואינו מפיל את המסך. אם אין מפתח
 * VAPID מהשרת הכפתור מושבת עם רמז מתאים.
 */

type Labels = {
  subscribe: string;
  subscribed: string;
  subscribing: string;
  denied: string;
  unsupported: string;
  missingKey: string;
  error: string;
};

/** המרת מפתח VAPID בסיס64-URL ל-ArrayBuffer כפי שדורש applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return buffer;
}

type Status = 'idle' | 'working' | 'subscribed' | 'denied' | 'error';

export default function PushOptInButton({
  vapidPublicKey,
  labels,
}: {
  vapidPublicKey: string | null;
  labels: Labels;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
    if (ok && Notification.permission === 'denied') setStatus('denied');
  }, []);

  async function subscribe() {
    setStatus('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      // רישום מפורש כדי לתמוך גם בסביבה שבה ה-Registrar האוטומטי אינו פועל.
      let registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey as string),
        }));

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }

  if (!supported) {
    return <p className="mt-2 text-xs text-[#8f8478]">{labels.unsupported}</p>;
  }

  const disabled = !vapidPublicKey || status === 'working' || status === 'subscribed';

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={subscribe}
        disabled={disabled}
        className="inline-flex items-center rounded-lg border border-[#d6c8b4] bg-white px-4 py-2 text-sm font-medium text-[#4a4038] transition hover:bg-[#faf6f0] disabled:opacity-60"
      >
        {status === 'working'
          ? labels.subscribing
          : status === 'subscribed'
            ? labels.subscribed
            : labels.subscribe}
      </button>
      {!vapidPublicKey ? (
        <p className="mt-1 text-xs text-[#8f8478]">{labels.missingKey}</p>
      ) : status === 'denied' ? (
        <p className="mt-1 text-xs text-red-600">{labels.denied}</p>
      ) : status === 'error' ? (
        <p className="mt-1 text-xs text-red-600">{labels.error}</p>
      ) : null}
    </div>
  );
}
