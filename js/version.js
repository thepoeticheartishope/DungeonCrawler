// The game's version, tiny under the title on the first screen (Timothy
// 2026-11-01: to see at a glance whether an update arrived). The version
// is the service worker's cache number (service-worker.js CACHE_NAME,
// term-dungeon-v###, bumped with every change to the game's files), so
// there is one number to keep, not two.
//
// The page asks the service worker serving it which cache it serves: the
// files this page is running came from that cache. With no worker in
// charge (a first visit, a private window, plain http) the page came
// from the server, so the server's service-worker.js says. Nothing found:
// the line stays empty.

const VERSION_RE = /term-dungeon-(v\d+)/;

// Fills `el` with the version (e.g. "v365"), when it is known.
export function showVersion(el) {
  fromWorker()
    .then(v => v || fromServer())
    .then((v) => { if (v) el.textContent = v; })
    .catch(() => {});
}

// The cache number of the worker serving this page, or null.
function fromWorker() {
  const sw = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  if (!sw) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      const m = VERSION_RE.exec(String(e.data || ''));
      resolve(m ? m[1] : null);
    };
    sw.postMessage('version', [channel.port2]);
  });
}

// The cache number in the server's service-worker.js, or null.
function fromServer() {
  return fetch('service-worker.js', { cache: 'no-store' })
    .then(r => (r.ok ? r.text() : ''))
    .then((text) => { const m = VERSION_RE.exec(text); return m ? m[1] : null; })
    .catch(() => null);
}
