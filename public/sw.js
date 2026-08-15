self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const urlString = e.request.url;

  // O Service Worker NÃO deve interceptar chamadas para rotas do Supabase e Realtime
  if (
    urlString.includes('supabase.co') ||
    urlString.includes('rest/v1') ||
    urlString.includes('auth/v1') ||
    urlString.includes('storage/v1') ||
    urlString.includes('functions/v1') ||
    urlString.includes('realtime') ||
    /realtime/i.test(urlString)
  ) {
    // Retornando sem chamar e.respondWith, o navegador faz o fetch normal diretamente na rede
    return;
  }

  const url = new URL(urlString);

  const handleFetch = async () => {
    try {
      if (url.hostname === 'localhost') {
        // Localhost: Network First
        try {
          return await fetch(e.request);
        } catch (netErr) {
          console.warn('Network fetch failed on localhost, trying cache fallback:', netErr);
          const cachedResponse = await caches.match(e.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw netErr;
        }
      } else {
        // Outros: Cache First
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return await fetch(e.request);
      }
    } catch (err) {
      console.error('Fetch handler failed for URL:', urlString, err);
      return Response.error();
    }
  };

  e.respondWith(handleFetch());
});
