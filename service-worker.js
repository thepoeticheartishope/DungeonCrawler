// Noesis Protocol service worker.
// Caches the app shell on install, then serves from cache first so the
// game loads instantly and still works with no connection. Bump
// CACHE_NAME whenever the cached files change, so old caches get cleared.

const CACHE_NAME = 'term-dungeon-v332';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/dpad.js',
  './js/state.js',
  './js/grid.js',
  './js/random.js',
  './js/gate.js',
  './js/quiz.js',
  './js/render.js',
  './js/mapview.js',
  './js/roomview.js',
  './js/roomthings.js',
  './js/roomgun.js',
  './js/roomsky.js',
  './js/playerform.js',
  './js/mapshared.js',
  './js/stickforms.js',
  './js/swirl.js',
  './js/sight.js',
  './js/look.js',
  './js/walkpace.js',
  './js/walk.js',
  './js/moves3d.js',
  './js/figure3d.js',
  './js/tutorial.js',
  './js/advanced.js',
  './js/testroom.js',
  './js/battery.js',
  './js/bookview.js',
  './js/pageturn.js',
  './js/tubeart.js',
  './js/gaze.js',
  './js/combat.js',
  './js/moves.js',
  './js/answers.js',
  './js/dungeon.js',
  './js/plans.js',
  './js/floor.js',
  './js/floors.js',
  './js/run.js',
  './js/beats.js',
  './js/rooms.js',
  './js/decor.js',
  './js/passage.js',
  './js/main.js',
  './js/introview.js',
  './js/sets.js',
  './js/setloader.js',
  './js/setpicker.js',
  './js/practice.js',
  './js/devpanel.js',
  './js/battlescreen.js',
  './js/gunactions.js',
  './js/controls.js',
  './js/text.js',
  './js/light.js',
  './js/modifiers.js',
  './js/haunts.js',
  './js/exchange.js',
  './js/gun.js',
  './js/goals.js',
  './js/relays.js',
  './js/saferoom.js',
  './js/desk.js',
  './js/charger.js',
  './js/stations.js',
  './js/chargerview.js',
  './js/vents.js',
  './js/windows.js',
  './js/lamps.js',
  './js/spots.js',
  './js/shadows.js',
  './js/warning.js',
  './js/noise.js',
  './js/static.js',
  './js/staticview.js',
  './js/realclock.js',
  './js/exchangeview.js',
  './js/questionview.js',
  './js/minigames.js',
  './js/minigameview.js',
  './js/gunpanels.js',
  './js/dialview.js',
  './js/minimapview.js',
  './js/dataview.js',
  './lists/manifest.json',
  './lists/comptia-aplus.json',
  './lists/bible-trivia.json',
  './lists/bible-quiz-bowl.json',
  './lists/dictionaries/bible.json',
  './lists/dictionaries/comptia-aplus.json',
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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
