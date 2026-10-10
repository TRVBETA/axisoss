/* ------------------------------------------
   AXIS // Offline shell service worker
   - API calls are NEVER cached. Data always comes from the network.
   - Static shell uses stale-while-revalidate: instant paint, fresh copy
     quietly swapped in for next load. New deploys propagate on their own.
   - Navigations are network-first; offline falls back to the cached shell.
   ------------------------------------------ */

// Bump this on every build: a changed name forces the browser to re-run
// install+precache, so each deploy ships atomically fresh files (no
// index-new/scripts-stale mismatch window). The activate handler below
// deletes the old cache automatically.
const AXIS_SW_CACHE = 'axis-shell-v58';
const AXIS_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/auth.js',
  '/idle.js',
  '/slider.js',
  '/supabase.js',
  '/core.js',
  '/modals.js',
  '/fitness.js',
  '/sleep.js',
  '/music.js',
  '/library.js',
  '/journal.js',
  '/design.js',
  '/nutrition.js',
  '/config.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(AXIS_SW_CACHE);
    await Promise.allSettled(AXIS_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith('axis-shell-') && name !== AXIS_SW_CACHE)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

async function putIfOk(cache, request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  try { await cache.put(request, response.clone()); } catch {}
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API and auth are always live. Never cache them.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, shell fallback when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(AXIS_SW_CACHE);
      try {
        const response = await fetch(request);
        await putIfOk(cache, '/index.html', response.clone());
        return response;
      } catch {
        const cached = await cache.match('/index.html');
        if (cached) return cached;
        throw new Error('OFFLINE');
      }
    })());
    return;
  }

  // Static shell: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(AXIS_SW_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then(async (response) => {
        await putIfOk(cache, request, response);
        return response;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network.then(() => {}));
      return cached;
    }
    const response = await network;
    if (response) return response;
    return Response.error();
  })());
});
