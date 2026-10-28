const CACHE_VERSION = 'ubt-v5-prod-20261028';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const urlString = e.request.url;

  // 1. O Service Worker NUNCA deve interceptar ou cachear Supabase, Realtime, manifest e sw
  if (
    urlString.includes('supabase.co') ||
    urlString.includes('rest/v1') ||
    urlString.includes('auth/v1') ||
    urlString.includes('storage/v1') ||
    urlString.includes('functions/v1') ||
    urlString.includes('realtime') ||
    /realtime/i.test(urlString) ||
    urlString.includes('manifest') ||
    urlString.includes('sw.js')
  ) {
    return;
  }

  const url = new URL(urlString);

  const handleFetch = async () => {
    try {
      // HTML ou requisições de navegação: Network First com fallback de cache
      if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        try {
          const freshResponse = await fetch(e.request);
          return freshResponse;
        } catch (netErr) {
          const cachedResponse = await caches.match(e.request);
          if (cachedResponse) return cachedResponse;
          throw netErr;
        }
      }

      if (url.hostname === 'localhost') {
        // Localhost: Network First
        try {
          return await fetch(e.request);
        } catch (netErr) {
          const cachedResponse = await caches.match(e.request);
          if (cachedResponse) return cachedResponse;
          throw netErr;
        }
      } else {
        // Assets estáticos versionados: Stale-While-Revalidate
        const cachedResponse = await caches.match(e.request);
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || (await fetchPromise) || Response.error();
      }
    } catch (err) {
      console.error('Fetch handler failed for URL:', urlString, err);
      return Response.error();
    }
  };

  e.respondWith(handleFetch());
});
