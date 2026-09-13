/**
 * SMRITI SERVICE WORKER (OFFLINE-FIRST SHELL & CACHE CONTROLLER)
 * Provides reliable offline execution for Senior Space and Caretaker Studio.
 * Uses targeted caching strategies for static shell, external CDNs, media, and API responses.
 */

const SHELL_CACHE = 'smriti-shell-v2';
const CDN_CACHE = 'smriti-cdn-v1';
const MEDIA_CACHE = 'smriti-media-v1';
const API_CACHE = 'smriti-api-v1';

const CORE_SHELL_URLS = [
  '/',
  '/senior-space',
  '/caretaker-studio',
  '/auth',
  '/games',
  '/src/pages/senior-space.html',
  '/src/pages/caretaker-studio.html',
  '/src/auth/auth.html',
  '/src/styles/styles.css',
  '/src/services/api-client.js',
  '/src/services/firebase-client.js',
  '/src/services/relationship-client.js',
  '/src/services/media-client.js',
  '/src/services/profile-client.js',
  '/src/services/voice-service.js',
  '/src/services/offline-db.js',
  '/src/services/offline-sync-service.js',
  '/src/services/cognitive-client.js',
  '/src/services/offline-prep-service.js',
  '/src/components/audio.js',
  '/src/auth/auth-state.js',
  '/src/utils/router.js',
  '/src/sw-register.js',
  '/manifest.json'
];

const EXTERNAL_CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400;1,500&display=swap'
];

// 1. Install Event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      // Cache local shell resources
      for (const url of CORE_SHELL_URLS) {
        try {
          await shellCache.add(url);
        } catch (e) {
          console.warn(`[SW] Non-critical shell cache skip for ${url}:`, e.message);
        }
      }

      // Try pre-caching CDN assets
      const cdnCache = await caches.open(CDN_CACHE);
      for (const url of EXTERNAL_CDN_URLS) {
        try {
          await cdnCache.add(url);
        } catch (e) {
          console.warn(`[SW] Optional CDN pre-cache skip for ${url}:`, e.message);
        }
      }

      await self.skipWaiting();
    })()
  );
});

// 2. Activate Event: Clean old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = [SHELL_CACHE, CDN_CACHE, MEDIA_CACHE, API_CACHE];
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!expectedCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// 2b. Message Event: Support immediate activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 3. Fetch Event: Multi-strategy caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Non-GET requests (e.g. POST /api/sync/sessions, PUT) -> Always Network
  if (request.method !== 'GET') {
    return;
  }

  // B. Never cache authentication or real-time sync endpoints
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/sync')) {
    return;
  }

  // C. Navigation Requests (HTML Page loads e.g. /senior-space)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network first with a quick timeout (1800ms)
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network navigation timeout')), 1800)
          );
          const res = await Promise.race([networkPromise, timeoutPromise]);
          if (res && res.status === 200) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, res.clone());
            return res;
          }
        } catch (err) {
          // Network failed or timed out — check cache
        }

        // Offline navigation fallback: serve cached page
        const cached = await caches.match(request);
        if (cached) return cached;

        // Route specific fallbacks
        if (url.pathname.includes('senior-space') || url.pathname.includes('games')) {
          const fallback = await caches.match('/senior-space') || await caches.match('/src/pages/senior-space.html');
          if (fallback) return fallback;
        }

        if (url.pathname.includes('caretaker-studio')) {
          const fallback = await caches.match('/caretaker-studio') || await caches.match('/src/pages/caretaker-studio.html');
          if (fallback) return fallback;
        }

        return (await caches.match('/')) || Response.error();
      })()
    );
    return;
  }

  // D. Read-only dynamic APIs: /api/preview/* or /api/cognitive/activities/*
  if (url.pathname.startsWith('/api/preview') || url.pathname.startsWith('/api/cognitive/activities')) {
    event.respondWith(
      (async () => {
        try {
          // Network First with 2500ms timeout
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const response = await fetch(request, { signal: controller.signal });
          clearTimeout(timer);

          if (response && response.status === 200) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
            return response;
          }
        } catch (e) {
          // Network failed or timed out -> serve cached API payload
        }

        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        return new Response(JSON.stringify({ offline: true, error: 'Offline - cached data unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
    return;
  }

  // E. CDN resources (Tailwind, Google Fonts, UNPKG)
  if (url.hostname.includes('cdn.tailwindcss.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const res = await fetch(request);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const cache = await caches.open(CDN_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch (e) {
          if (cached) return cached;
          return Response.error();
        }
      })()
    );
    return;
  }

  // F. Media files (Photos, Audios, Avatars)
  if (request.destination === 'image' || request.destination === 'audio' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg)$/i)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const cache = await caches.open(MEDIA_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch (e) {
          // Return cached if available, else empty fallback
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // G. Static assets (Local CSS, JS, JSON) -> Cache First with background refresh
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      const fetchPromise = fetch(request)
        .then(async (res) => {
          if (res && res.status === 200) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })()
  );
});
