// Minimal service worker: enables PWA installability and offline navigation
// fallback. Only navigation requests are intercepted, so Supabase API and
// realtime traffic are never touched.
const CACHE = "bibsync-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await caches.match(request);
        return cached ?? Response.error();
      }
    })(),
  );
});
