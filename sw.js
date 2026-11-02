// Ojas Service Worker for Offline Caching and PWA Standalone Mode
const CACHE_NAME = 'ojas-upeprint-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/pages/portal.html',
  '/pages/admin.html',
  '/pages/tools.html',
  '/manifest.json',
  '/images/logo.png',
  '/templates/caste.html',
  '/templates/domicile.html',
  '/templates/evoter.html',
  '/templates/annexure-1.html',
  '/templates/annexure-1a.html',
  '/templates/annexure-3.html',
  '/templates/annexure-3a.html',
  '/templates/annexure-b.html',
  '/templates/annexure-c.html',
  '/templates/annexure-d.html',
  '/templates/annexure-e.html',
  '/templates/annexure-f.html',
  '/css/theme.css',
  '/js/theme.js',
  '/js/config.js',
  '/js/pdf-engine.js',
  '/js/config-templates.js',
  '/js/portal-forms.js',
  '/js/portal-wallet-chat.js',
  '/js/admin-logic.js',
  '/js/tools-logic.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
