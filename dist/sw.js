// Increment this version when changing the offline app shell.
const CACHE_PREFIX = `tap-timer-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v30`;
const ASSETS = ['./', './index.html', './style.css?v=30', './app.js?v=30', './manifest.webmanifest', './icons/icon-192.png?v=6', './icons/icon-512.png?v=6', './icons/apple-touch-icon.png?v=6'];
self.addEventListener('install', event => {
  const requests = ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(requests)));
});
// Updated workers activate after all windows using the old version close.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate') return await cache.match(new URL('./index.html', scope));
      throw error;
    }
  }));
});
