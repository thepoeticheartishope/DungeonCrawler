// Noesis Protocol service worker.
// Caches the app shell on install, then serves from cache first so the
// game loads instantly and still works with no connection. Bump
// CACHE_NAME whenever the cached files change, so old caches get cleared.

const CACHE_NAME = 'term-dungeon-v415';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/dpad.js',
  './js/state.js',
  './js/grid.js',
  './js/random.js',
  './js/quiz.js',
  './js/render.js',
  './js/mapview.js',
  './js/roomview.js',
  './js/roomthings.js',
  './js/roomgun.js',
  './js/roomsky.js',
  './js/playerform.js',
  './js/mapshared.js',
  './js/sight.js',
  './js/look.js',
  './js/walk.js',
  './js/moves3d.js',
  './js/figure3d.js',
  './js/bookview.js',
  './js/pageturn.js',
  './js/moves.js',
  './js/plans.js',
  './js/rooms.js',
  './js/sprites.js',
  './rooms/ship.json',
  './sprites/sprites.json',
  './sprites/desk.png',
  './sprites/chicken.png',
  './js/floor.js',
  './js/decor.js',
  './js/passage.js',
  './js/main.js',
  './js/sets.js',
  './js/factgen.js',
  './js/factcheck.js',
  './js/setloader.js',
  './js/setpicker.js',
  './js/practice.js',
  './js/mastery.js',
  './js/masteryview.js',
  './js/devpanel.js',
  './js/gunactions.js',
  './js/controls.js',
  './js/text.js',
  './js/modifiers.js',
  './js/saferoom.js',
  './js/wires.js',
  './js/stations.js',
  './js/ship.js',
  './js/roles.js',
  './js/consoleview.js',
  './js/shipview.js',
  './js/space.js',
  './js/chargerview.js',
  './js/windows.js',
  './js/questionview.js',
  './js/minigames.js',
  './js/bosschat.js',
  './js/minigameview.js',
  './js/gunpanels.js',
  './js/minimapview.js',
  './js/music.js',
  './js/sound.js',
  './js/textsize.js',
  './js/version.js',
  './js/sfx.js',
  './js/zodiac.js',
  './audio/answer-right-soft-good.wav',
  './audio/answer-wrong-simple-03.wav',
  './js/dataview.js',
  './lists/manifest.json',
  './lists/comptia-aplus.json',
  './lists/bible-quiz-bowl.json',
  './lists/facts/bible-quiz-bowl.json',
  './lists/facts/comptia-aplus.json',
  './lists/images/cpu-chip.svg',
  './lists/images/cable-stripper.svg',
  './lists/images/cable-tester.svg',
  './lists/images/crimper.svg',
  './lists/images/loopback-plug.svg',
  './lists/images/punchdown-tool.svg',
  './lists/images/toner-probe.svg',
  './lists/images/wifi-analyzer.svg',
  './lists/images/rj45.svg',
  './lists/images/rj11.svg',
  './lists/images/f-type.svg',
  './lists/images/st-fiber.svg',
  './lists/images/lc-fiber.svg',
  './lists/images/db9.svg',
  './lists/images/molex.svg',
  './lists/images/usb-b.svg',
  './lists/images/usb-c.svg',
  './lists/images/lightning.svg',
  './lists/images/hdmi.svg',
  './lists/images/displayport.svg',
  './lists/images/vga.svg',
  './lists/images/dvi.svg',
  './lists/images/m2-ssd.svg',
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

// The page asks which cache this worker serves, to show the game's
// version on the first screen (js/version.js).
self.addEventListener('message', (event) => {
  if (event.data === 'version' && event.ports[0]) event.ports[0].postMessage(CACHE_NAME);
});

// A furniture sprite not in APP_SHELL (a PNG Timothy added in sprites/,
// sprites/README.md) is kept once fetched, so it works offline too.
const KEEP_FETCHED = '/sprites/';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).pathname.includes(KEEP_FETCHED)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
