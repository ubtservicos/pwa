self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // O Service Worker NÃO deve interceptar chamadas para rotas do Supabase e Realtime
  if (
    url.includes('supabase.co') ||
    url.includes('rest/v1') ||
    url.includes('auth/v1') ||
    url.includes('storage/v1') ||
    url.includes('functions/v1') ||
    url.includes('realtime') ||
    /realtime/i.test(url)
  ) {
    // Retornando sem chamar e.respondWith, o navegador faz o fetch normal diretamente na rede
    return;
  }

  // Pass-through to network
  e.respondWith(fetch(e.request));
});
