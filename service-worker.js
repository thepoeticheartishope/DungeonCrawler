// Noesis Protocol service worker.
// Caches the app shell on install, then serves from cache first so the
// game loads instantly and still works with no connection. Bump
// CACHE_NAME whenever the cached files change, so old caches get cleared.

const CACHE_NAME = 'term-dungeon-v40';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/state.js',
  './js/quiz.js',
  './js/render.js',
  './js/combat.js',
  './js/dungeon.js',
  './js/main.js',
  './js/sets.js',
  './lists/manifest.json',
  './lists/comptia-aplus.json',
  './lists/bible-trivia.json',
  './lists/bible-quiz-bowl.json',
  './lists/images/cpu-chip.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
