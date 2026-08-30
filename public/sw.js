/**
 * Service Worker בסיסי ל-PWA — מאפשר התקנה ונראות בסיסית במצב לא מקוון.
 * אסטרטגיה: network-first עבור ניווטים, עם נפילה למטמון (cache) בעת כשל רשת.
 * דחיפת התראות (push) תמומש מאחורי ממשק בהמשך.
 */
const CACHE = 'torchick-shell-v4';
const SHELL = ['/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // ניווטים: network-first עם נפילה למטמון.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (r) =>
              r ||
              new Response(
                '<!doctype html><meta charset="utf-8"><title>לא מקוון</title><body dir="rtl" style="font-family:sans-serif;padding:2rem">אין חיבור לרשת. נסה שוב.',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
              ),
          ),
        ),
    );
    return;
  }

  // נכסים סטטיים: cache-first.
  if (request.url.includes('/icons/')) {
    event.respondWith(caches.match(request).then((r) => r || fetch(request)));
  }
});

/**
 * דחיפת Web Push: מציג התראה מקומית מתוך המטען שנשלח מהשרת.
 * המטען הוא JSON: { title, body, url }. נופלים בחן לברירות מחדל אם הפענוח נכשל.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // מטען לא-JSON — משתמשים בטקסט גולמי כגוף ההתראה.
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'תור צ׳יק';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    data: { url: data.url || '/admin' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * לחיצה על ההתראה: ממקד חלון פתוח של האפליקציה אם קיים, אחרת פותח חדש בכתובת היעד.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // אם כבר יש חלון פתוח באותו origin — ממקדים אותו ומנווטים ליעד.
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl).catch(() => {});
          }
          return undefined;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
