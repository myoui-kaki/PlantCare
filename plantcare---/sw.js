/* =====================================================
   PLANTCARE PWA v2 — sw.js
   Offline support, push notifications, standalone launch
===================================================== */
const CACHE_NAME    = 'plantcare-v15';
const DYNAMIC_CACHE = 'plantcare-dynamic-v15';

const STATIC_ASSETS = [
  './',
  './index.html',
  './main.css',
  './components.css',
  './animations.css',
  './additions.css',
  './app.js',
  './auth.js',
  './db.js',
  './doctor.js',
  './gamification.js',
  './notifications.js',
  './plants.js',
  './router.js',
  './schedule.js',
  './tips.js',
  './analytics.js',
  './ml_predict.js',
  './manifest.json',
  './icons/icon-72.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// Install — cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache error:', err))
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Never cache EmailJS / CDN
  if (url.hostname.includes('emailjs.com') || url.hostname.includes('jsdelivr.net')) return;

  // Weather API — network first, graceful offline fallback
  if (url.hostname === 'api.open-meteo.com') {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // API calls — network first, then offline error
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ detail: 'You are offline. Please reconnect.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Static assets — cache first, fallback to network then offline page
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// ── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data  = event.data ? event.data.json() : {};
  const title = data.title || '🌿 PlantCare';
  const body  = data.body  || 'Your plants need attention!';
  const tag   = data.tag   || 'plantcare-reminder';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     './icons/icon-192.svg',
      badge:    './icons/icon-72.svg',
      tag,
      renotify: true,
      vibrate:  [300, 100, 300, 100, 300],
      data,
      actions: [
        { action: 'done',   title: '✓ Mark Done' },
        { action: 'snooze', title: '⏱ Snooze 30min' },
      ],
    })
  );
});

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;
  const notifData = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(c => c.url.includes('index.html') && 'focus' in c);
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NOTIF_CLICK', action, data: notifData });
      } else {
        clients.openWindow('./index.html#dashboard').then(client => {
          if (client) client.postMessage({ type: 'NOTIF_CLICK', action, data: notifData });
        });
      }
    })
  );
});

// ── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-plants') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(cls => {
        cls.forEach(c => c.postMessage({ type: 'SYNC_PLANTS' }));
      })
    );
  }
});
