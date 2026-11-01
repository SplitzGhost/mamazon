const CACHE = 'mamazon-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// Immer zuerst das Netz, damit neue Versionen sofort ankommen. Der Speicher hilft nur ohne Empfang.
// „no-cache“ fragt auch am Browser-Speicher vorbei nach, GitHub Pages erlaubt dort sonst 10 Minuten alte Dateien.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) ?? Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  const message = event.data?.json() ?? { title: 'MamaZon', body: 'Es gibt etwas Neues.' };
  event.waitUntil((async () => {
    await self.registration.showNotification(message.title, {
      body: message.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    });
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.postMessage('refresh');
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const [client] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (client) return client.focus();
    return self.clients.openWindow('./');
  })());
});
