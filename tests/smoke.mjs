// Smoke tests for Noesis Protocol: the ship, in a real browser.
//
// Run: node tests/smoke.mjs (SMOKE_ONLY=ship and SMOKE_REPEAT=20 pick runs
// and repeat them; SMOKE_JOBS=4, the default, runs that many at once,
// SMOKE_JOBS=1 one after another; see main). Each run's time is in the
// report.
//
// Waiting: wait for what a check needs (waitUntil, a selector),
// not a fixed time, where you can: on a busy machine frames come slower.
// Never Playwright's waitForFunction with an async check: it counts the
// promise as true and doesn't wait. Keep no shared state between runs (they
// go at once): keep it per page.
//
// Starts a static server for this repo, then drives the game in a real
// browser via Playwright (imported from ~/Repo/codecraft-classroom/node_modules
// — do NOT add Playwright or node_modules to this repo), picking the
// built-in "Bible Quiz Bowl" set on the set screen:
//
//   Ship run: the tragedy, TAKE COMMAND, the ship HUD, the console's
//   training wires and a breaker, the Engineer's board, COMMAND.SYS, and a
//   role learned and taught (runShip's detail says it all).
//
// The dungeon's runs (skip-room, battle, gun, tutorial, test rooms and the
// rest) went with its floors in dungeon removal step B; the old PRs keep
// them.
//
// Every run must produce zero console errors or page errors. Exits non-zero
// on any failure.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import os from 'node:os';

const require = createRequire(
  path.join(process.env.HOME, 'Repo/codecraft-classroom/smoke-test-resolver.js')
);
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Static server never came up at ${url}`);
}

// ---- Shared page setup ----

// Attaches console/pageerror collectors to a page. Returns the arrays,
// which fill in as the page runs.
function collectErrors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });
  return { consoleErrors, pageErrors };
}

// Loads the page fresh, ready for #startBtn.
async function loadPageAndSet(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
}

// Asks `fn` in the page (it may be async) every 50 ms until it gives
// something truthy, up to `timeout` ms; returns it, or throws on timeout.
// Not Playwright's waitForFunction: an async check hands it a promise,
// which counts as true at once, so it never waited (found 2026-10-28).
async function waitUntil(page, fn, arg = null, timeout = 5000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await page.evaluate(fn, arg);
    if (value) return value;
    if (Date.now() > end) throw new Error('timed out after ' + timeout + ' ms waiting for ' + fn.toString().replace(/\s+/g, ' ').slice(0, 100));
    await page.waitForTimeout(50);
  }
}

async function guarded(run, browser, url) {
  try {
    return await run(browser, url);
  } catch (err) {
    const where = String(err.stack || '').split('\n').find(l => l.includes('smoke.mjs')) || '';
    return { ok: false, reason: `${err.message.split('\n')[0]} ${where.trim()}`, consoleErrors: [], pageErrors: [] };
  }
}

async function runShip(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkShip(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: '"Ship (test)" told the tragedy, a tap put every line up and a second took command, putting the player in Command with the ship HUD (TAUGHT, CALM, no clock, no burns), lit, no stick men; the console\'s Engineer opened POWER.SYS training wires, a breaker asked its question, a right answer closed it and the wires came back; the Engineer\'s board stayed shut until trained, then opened to teach; COMMAND.SYS listed the roles, BACK left a lesson for the list again, a right round learned the Navigator, and its three rounds of Close Enough taught it (TAUGHT 1 on the HUD)', consoleErrors, pageErrors };
}

// Stands the player at (row, col) facing up and holds ArrowUp: a walk up
// into what is above, one bump. One stick: a key tap shorter than
// ONE_STICK.tapMs only turns, and pushing on bumps again after
// bumpRepeatMs, so the hold is longer than the first and shorter than both.
const BUMP_HOLD_MS = 350;
async function bumpUpFrom(page, row, col) {
  await page.evaluate(async ([r, c]) => {
    const { state } = await import('./js/state.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    f.playerRow = r; f.playerCol = c; f.playerAt = null; f.facing = 'N'; f.look = 0;
    computeVisibility();
  }, [row, col]);
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(BUMP_HOLD_MS);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
}

async function checkShip(page, url) {
  await loadPageAndSet(page, url);
  // The ship's opening (step C): the tragedy, then TAKE COMMAND. The title
  // leads with the start screen's name (Timothy 2026-11-02).
  await page.fill('#playerName', 'Tess');
  await page.click('#startBtn');
  await page.click('#pickScreen .set-option[data-set="builtin:bible-quiz-bowl"]');
  await page.waitForSelector('#shipIntroScreen.show', { timeout: 10000 });
  const intro = await page.textContent('#shipIntroLines');
  const introTitle = await page.textContent('#shipIntroTitle');
  if (!/^TESS, THERE.S BEEN A TRAGEDY$/.test(introTitle)) return 'the tragedy title did not lead with the name: ' + introTitle;
  if (!/Day \d+ of the crossing\./.test(intro) || !/Captain \w+ died/.test(intro)) return 'the tragedy was not told: ' + intro;
  // Clicked through (Timothy 2026-10-31): a tap puts every line up at once,
  // a second one takes command.
  await page.click('#shipIntroLines');
  await waitUntil(page, () => document.getElementById('shipIntroScreen').classList.contains('all-in'));
  if (!await page.isVisible('#shipIntroScreen.show')) return 'the first tap on the tragedy left it instead of showing every line';
  await page.click('#shipIntroLines');
  await page.waitForSelector('#roomScreen.show', { timeout: 10000 });
  const hud = await page.evaluate(() => ({
    ship: document.getElementById('statsBar').classList.contains('ship-hud'),
    clock: Boolean(document.getElementById('shipClock')),
    burns: Boolean(document.getElementById('shipBurns')),
    taught: document.getElementById('shipTaught').textContent,
    crew: document.getElementById('shipPanic').textContent,
  }));
  // No arrival clock (Timothy 2026-10-31: no timers on the ship), no burns
  // (2026-11-01, ship minigames plan step G1).
  if (!hud.ship || hud.clock || hud.burns || !/^0\/\d+$/.test(hud.taught) || hud.crew !== 'CALM') return 'the ship HUD did not show: ' + JSON.stringify(hud);
  const start = await page.evaluate(async () => {
    const { state, key } = await import('./js/state.js');
    const f = state.floor;
    const room = f.chamberNames[f.chamberAt.get(key(f.playerRow, f.playerCol))];
    const dark = [...f.chamberAt.keys()].filter(k => !f.visibleSet.has(k)).length;
    const console = f.props.find(p => p.kind === 'console');
    const board = f.props.find(p => p.kind === 'powerBoard');
    return { ship: f.ship, room, dark, minions: f.minions.length, console, board };
  });
  if (!start.ship) return 'the ship option did not start on the ship';
  if (start.room !== 'plan.ship.command') return 'did not start in Command: ' + start.room;
  if (start.dark) return start.dark + ' room tiles not seen: the ship should have no dark areas';
  if (start.minions) return 'stick men on the ship';
  if (!start.console || !start.board) return 'no console or power board';

  // The console: COMMAND.SYS's roles (crew roles plan step B), the
  // Engineer picked: training wires with an open breaker.
  await bumpUpFrom(page, start.console.row + 1, start.console.col);
  await waitUntil(page, () => !document.getElementById('consolePanel').hidden);
  const listed = await page.$$eval('.console-role', bs => bs.map(b => b.dataset.role));
  if (listed.length !== 12 || listed[0] !== 'engineer') return 'COMMAND.SYS did not list the Engineer and eleven roles: ' + listed.join(',');
  await page.click('.console-role[data-role="engineer"]');
  await waitUntil(page, () => !document.getElementById('chargerPanel').hidden);
  const title = await page.textContent('#chargerTitle');
  if (title !== 'POWER.SYS') return 'the console opened "' + title + '", not POWER.SYS';
  if (!await page.$('.charger-wire.breaker.open')) return 'no open breaker on the training wires';

  // A breaker asks; the right answer closes it and the wires come back.
  // DEV Auto-win's way of answering right (a minigame too), then again to
  // close the held book.
  await page.click('.charger-wire.breaker.open');
  await waitUntil(page, () => document.getElementById('askTitle').textContent === 'BREAKER' && document.getElementById('askTitle').offsetParent);
  await page.waitForTimeout(300);
  await page.evaluate(async () => (await import('./js/gunactions.js')).autoWinGun());
  await page.waitForTimeout(300);
  await page.evaluate(async () => (await import('./js/gunactions.js')).autoWinGun());
  await waitUntil(page, () => !document.getElementById('chargerPanel').hidden);
  const closed = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const p = state.floor.props.find(q => q.kind === 'console');
    return p.puzzle ? p.puzzle.closed.length : -1;
  });
  if (closed !== 1) return 'a right answer did not close the breaker (closed: ' + closed + ')';
  await page.keyboard.press('Escape');
  await waitUntil(page, () => document.getElementById('chargerPanel').hidden);

  // The Engineer's board: shut until trained, then open to teach.
  await bumpUpFrom(page, start.board.row + 1, start.board.col);
  if (await page.evaluate(() => !document.getElementById('chargerPanel').hidden)) return 'the power board opened before training';
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.run.trained = ['engineer'];
  });
  await bumpUpFrom(page, start.board.row + 1, start.board.col);
  await waitUntil(page, () => !document.getElementById('chargerPanel').hidden);
  const sub = await page.textContent('#chargerSub');
  if (!sub.includes('TEACHING')) return 'the trained board did not open to teach: ' + sub;
  await page.keyboard.press('Escape');
  await waitUntil(page, () => document.getElementById('chargerPanel').hidden);

  // Learning the Navigator at the console (step B): a right round of Close
  // Enough learns it.
  await bumpUpFrom(page, start.console.row + 1, start.console.col);
  await waitUntil(page, () => !document.getElementById('consolePanel').hidden);
  // BACK (Timothy 2026-10-31): a lesson picked can be left before an
  // answer, back to COMMAND.SYS with nothing learned.
  await page.click('.console-role[data-role="pilot"]');
  await waitUntil(page, () => !document.getElementById('askBack').hidden && document.getElementById('askBack').offsetParent);
  await page.click('#askBack');
  await waitUntil(page, () => !document.getElementById('consolePanel').hidden);
  const backed = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return { learning: state.run.ship.learning, trained: state.run.trained.includes('pilot') };
  });
  if (backed.learning || backed.trained) return 'BACK on a lesson did not drop it: ' + JSON.stringify(backed);
  await page.click('.console-role[data-role="navigator"]');
  await waitUntil(page, () => /LEARNING NAVIGATOR/.test(document.getElementById('askTitle').textContent) && document.getElementById('askTitle').offsetParent);
  await page.evaluate(async () => (await import('./js/gunactions.js')).autoWinGun());
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    if ((await import('./js/gunpanels.js')).askHeld()) (await import('./js/gunactions.js')).autoWinGun();
  });
  await page.waitForTimeout(400);
  const learned = await page.evaluate(async () => (await import('./js/state.js')).state.run.trained);
  if (!learned.includes('navigator')) return 'a right learning round did not learn the Navigator: ' + JSON.stringify(learned);

  // The Navigator, learned, runs three rounds of Close Enough; answered
  // right (Auto-win's way), it is taught.
  const navigator = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return state.floor.props.find(p => p.kind === 'crew' && p.role === 'navigator');
  });
  await bumpUpFrom(page, navigator.row + 1, navigator.col);
  await waitUntil(page, () => /NAVIGATOR/.test(document.getElementById('askTitle').textContent) && document.getElementById('askTitle').offsetParent);
  for (let round = 0; round < 3; round++) {
    await page.evaluate(async () => (await import('./js/gunactions.js')).autoWinGun());
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      if ((await import('./js/gunpanels.js')).askHeld()) (await import('./js/gunactions.js')).autoWinGun();
    });
    await page.waitForTimeout(400);
  }
  const taught = await page.evaluate(async () => (await import('./js/state.js')).state.run.ship.taught);
  if (!taught.includes('navigator')) return 'three right rounds did not teach the Navigator: ' + JSON.stringify(taught);
  // The HUD counts it (crew roles plan step C).
  await page.waitForTimeout(300);
  const counted = await page.textContent('#shipTaught');
  if (!/^1\/\d+$/.test(counted)) return 'the HUD did not count the Navigator taught: ' + counted;
  return null;
}

// ---- The safe room ----

async function main() {
  const port = await findFreePort();
  const server = spawn(process.execPath, [
    path.join(__dirname, 'static-server.mjs'),
    REPO_ROOT,
    String(port),
  ], { stdio: 'inherit' });

  const cleanup = () => {
    if (!server.killed) server.kill();
  };
  process.on('exit', cleanup);

  try {
    // ?dev: the DEV tools these runs use are hidden without it.
    const url = `http://127.0.0.1:${port}/?dev`;
    await waitForServer(url);

    const browser = await chromium.launch();
    try {
      const RUNS = [
        ['ship', runShip, url],
      ];
      // SMOKE_ONLY=tutorial,answer runs only the runs whose names hold one
      // of those words, SMOKE_REPEAT=20 runs each that many times: for
      // chasing a run that fails now and then.
      const only = (process.env.SMOKE_ONLY || '').split(',').map(w => w.trim()).filter(Boolean);
      const repeat = Math.max(1, Number(process.env.SMOKE_REPEAT) || 1);
      const chosen = RUNS.filter(([name]) => !only.length || only.some(w => name.includes(w)));
      // SMOKE_JOBS=4 (the default) runs that many at once, each in its own
      // browser context; SMOKE_JOBS=1 runs them one after another. The
      // report keeps the runs' order either way.
      const jobs = Math.max(1, Number(process.env.SMOKE_JOBS) || 4);
      const queue = chosen.flatMap(([name, run, address]) =>
        Array.from({ length: repeat }, (_, i) => [repeat > 1 ? `${name} #${i + 1}` : name, run, address]));
      const results = new Array(queue.length);
      let next = 0;
      const worker = async () => {
        while (next < queue.length) {
          const i = next++;
          const [name, run, address] = queue[i];
          const started = Date.now();
          const result = await guarded(run, browser, address);
          results[i] = [name, { ...result, secs: (Date.now() - started) / 1000 }];
        }
      };
      const started = Date.now();
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
      console.log(`${queue.length} runs, ${jobs} at a time, in ${((Date.now() - started) / 1000).toFixed(1)} s`);

      await browser.close();

      let failed = false;
      for (const [name, result] of results) {
        if (result.ok) {
          console.log(`PASS (${name}, ${result.secs.toFixed(1)} s): ${result.detail}`);
        } else {
          failed = true;
          console.error(`FAIL (${name}, ${result.secs.toFixed(1)} s): ${result.reason}`);
          if (result.consoleErrors.length) console.error(`  console errors: ${JSON.stringify(result.consoleErrors)}`);
          if (result.pageErrors.length) console.error(`  page errors: ${JSON.stringify(result.pageErrors)}`);
        }
      }

      process.exit(failed ? 1 : 0);
    } finally {
      if (browser.isConnected()) await browser.close();
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
