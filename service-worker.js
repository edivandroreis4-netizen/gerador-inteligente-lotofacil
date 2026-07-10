const CACHE_NAME = "lotofacil-inteligente-v2.3.3-layout-original-corrigido-r5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/data/resultados.js",
  "./js/services/gerador.service.js",
  "./js/services/estatisticas.service.js",
  "./js/services/storage.service.js",
  "./js/services/lotofacil-api.service.js",
  "./js/validators/aposta.validator.js",
  "./js/ui/alerts.ui.js",
  "./js/ui/charts.ui.js",
  "./assets/img/minha-foto.jpg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
