const cacheName = "form-survival-shell-v2";
const shell = ["/", "/site.css", "/app.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !shell.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname)));
});
