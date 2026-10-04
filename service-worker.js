// Noesis Protocol service worker.
// Caches the app shell on install, then serves from cache first so the
// game loads instantly and still works with no connection. Bump
// CACHE_NAME whenever the cached files change, so old caches get cleared.

const CACHE_NAME = 'term-dungeon-v146';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/dpad.js',
  './js/state.js',
  './js/quiz.js',
  './js/render.js',
  './js/mapview.js',
  './js/isoview.js',
  './js/textforms.js',
  './js/tileart.js',
  './js/sight.js',
  './js/combat.js',
  './js/moves.js',
  './js/answers.js',
  './js/dungeon.js',
  './js/floor.js',
  './js/floors.js',
  './js/run.js',
  './js/beats.js',
  './js/rooms.js',
  './js/decor.js',
  './js/passage.js',
  './js/main.js',
  './js/sets.js',
  './js/setloader.js',
  './js/devpanel.js',
  './js/text.js',
  './js/light.js',
  './js/modifiers.js',
  './js/haunts.js',
  './js/exchange.js',
  './js/gun.js',
  './js/realclock.js',
  './js/exchangeview.js',
  './js/questionview.js',
  './js/gunpanels.js',
  './js/dataview.js',
  './lists/manifest.json',
  './lists/comptia-aplus.json',
  './lists/bible-trivia.json',
  './lists/bible-quiz-bowl.json',
  './lists/dictionaries/bible.json',
  './lists/dictionaries/comptia-aplus.json',
  './lists/images/cpu-chip.svg',
  './fonts/VT323-Regular.ttf',
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
