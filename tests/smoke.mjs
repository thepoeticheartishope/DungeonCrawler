// Smoke tests for the Noesis Protocol dungeon crawler.
//
// Run: node tests/smoke.mjs
//
// Starts a static server for this repo, then drives the game in a real
// browser via Playwright (imported from ~/Repo/codecraft-classroom/node_modules
// — do NOT add Playwright or node_modules to this repo) through four runs,
// all loading the built-in "Bible Quiz Bowl" set with Auto-win on:
//
//   1. Skip-room run: one manual step, then "Skip room (dev)" repeatedly to
//      clear the floor, asserting the win or lose screen is reached.
//      A run is 7 floors (opening rest, then depth / rest three times, the
//      last rest being the epilogue), so it takes 7 skips; the cap is 10.
//   2. Battle run: skips out of the opening rest (it has no minions), then
//      walks with the arrow keys and "Skip turn" until a minion
//      engages and the battle screen appears, then lets Auto-win settle the
//      fight, asserting an ACCEPTED. line appeared in the encounter log and
//      the game is back on the room screen afterward (classic combat).
//   3. Gun run: DEV -> Combat on gun, then wanders as run 2 does, pressing
//      R to reload and F to fire (Auto-win answers the reload and stops the
//      damage bar on the weak point) until a reload loaded rounds and a
//      shot killed a minion.
//   4. Real-time run: Real time on (start screen), DEV -> Combat on gun,
//      Auto-win off. With the DEV panel open the clock holds still; closed,
//      the world takes turns with no input; the player's own steps don't
//      add turns, and arrows pressed faster than REALTIME_WALK_MS take one
//      step at most; the NEXT meter shows; and the clock keeps running
//      while a reload question is open over the map. Then the option is still checked after a reload
//      of the page (it's remembered).
//
// Every run must produce zero console errors or page errors. Exits non-zero
// on any failure.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

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

// Loads the page fresh and picks the built-in "Bible Quiz Bowl" set, ready
// for #startBtn. The loader panel is hidden behind a toggle, but the
// select/button still work when driven directly.
async function loadPageAndSet(page, url) {
  await page.goto(url, { waitUntil: 'load' });

  await page.waitForFunction(() => {
    const sel = document.getElementById('builtinSetSelect');
    return sel && [...sel.options].some((o) => o.value === 'bible-quiz-bowl');
  }, { timeout: 10000 });

  await page.evaluate(() => {
    const sel = document.getElementById('builtinSetSelect');
    sel.value = 'bible-quiz-bowl';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('loadBuiltinBtn').click();
  });

  // fetchBundledSet is async; wait for it to actually finish.
  await page.waitForFunction(() => {
    const status = document.getElementById('loaderStatus');
    return status && status.textContent.includes('Loaded "Bible Quiz Bowl"');
  }, { timeout: 10000 });
}

async function startGameAndWaitForRoom(page) {
  await page.click('#startBtn');
  // Start shows an intro glitch screen for a couple seconds before the
  // room screen appears.
  await page.waitForSelector('#roomScreen.show', { timeout: 10000 });
}

async function turnOnAutoWin(page) {
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devAutoWinBtn');
}

// ---- Run 1: skip-room ----

async function runSkipRoom(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);

  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);

  // Walk one step.
  await page.click('#btnN');

  await turnOnAutoWin(page);

  // Clear the run with "Skip room (dev)", which jumps straight to the next
  // room and triggers the win screen once every room is cleared.
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => {
      const win = document.getElementById('winScreen');
      const lose = document.getElementById('loseScreen');
      return win.classList.contains('show') || lose.classList.contains('show');
    });
    if (done) break;
    await page.click('#devSkipBtn');
    await page.waitForTimeout(200);
  }

  const result = await page.evaluate(() => {
    const win = document.getElementById('winScreen');
    const lose = document.getElementById('loseScreen');
    return {
      win: win.classList.contains('show'),
      lose: lose.classList.contains('show'),
    };
  });

  await context.close();

  if (!result.win && !result.lose) {
    return { ok: false, reason: 'neither win nor lose screen was reached', consoleErrors, pageErrors };
  }
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: `reached ${result.win ? 'win' : 'lose'} screen`, consoleErrors, pageErrors };
}

// ---- Run 2: battle ----

// Installs page-side observers (test-only, not game code) that record
// whether the battle screen was ever entered and whether an "ACCEPTED."
// line (js/text.js: 'log.accepted') was ever added to the encounter log.
// These persist for the life of the page, across chained encounters.
async function installBattleWatchers(page) {
  await page.evaluate(() => {
    window.__smokeEnteredBattle = false;
    window.__smokeAccepted = false;
    const battleScreen = document.getElementById('battleScreen');
    new MutationObserver(() => {
      if (battleScreen.classList.contains('show')) window.__smokeEnteredBattle = true;
    }).observe(battleScreen, { attributes: true, attributeFilter: ['class'] });

    const log = document.getElementById('encounterLog');
    new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.textContent && node.textContent.trim() === 'ACCEPTED.') {
            window.__smokeAccepted = true;
          }
        }
      }
    }).observe(log, { childList: true });
  });
}

const BATTLE_MAX_STEPS = 450;
const ARROW_KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

// One attempt: load a fresh run, turn on Auto-win, and wander (arrow keys,
// falling back to "Skip turn" when blocked) until a fight is seen through
// to settlement, or the step budget runs out.
async function attemptBattle(page, url) {
  await loadPageAndSet(page, url);
  await installBattleWatchers(page);
  await startGameAndWaitForRoom(page);
  await turnOnAutoWin(page);
  // The run opens on a rest floor with no minions: go down to depth 1.
  await page.click('#devSkipBtn');
  await page.waitForTimeout(200);

  let dir = 0;
  for (let i = 0; i < BATTLE_MAX_STEPS; i++) {
    const status = await page.evaluate(() => ({
      inBattle: document.getElementById('battleScreen').classList.contains('show'),
      inRoom: document.getElementById('roomScreen').classList.contains('show'),
      entered: window.__smokeEnteredBattle === true,
      accepted: window.__smokeAccepted === true,
    }));

    if (status.entered && status.accepted && status.inRoom) {
      return true;
    }

    if (status.inBattle) {
      // Auto-win is driving the fight; just wait it out.
      await page.waitForTimeout(250);
      continue;
    }

    // On the room screen: keep wandering. If the last step bumped into a
    // wall/obstacle, rotate clockwise (a simple wall-follower) so the walk
    // actually covers the maze instead of oscillating between two blocked
    // directions or wasting steps on a coin flip.
    const blocked = await page.evaluate(
      () => document.getElementById('roomFeedback').innerHTML.includes('block-msg')
    );
    if (blocked) dir = (dir + 1) % ARROW_KEYS.length;
    await page.keyboard.press(ARROW_KEYS[dir]);
    // Every so often, also use Skip turn (dpad center button), which lets
    // minions close in without the player having to path directly to one.
    // The arrow press just above can itself trigger an engage (the battle
    // screen replaces the room screen, hiding this button), so this click
    // is best-effort: a short timeout and a swallowed failure, not a hang —
    // the next loop iteration's status check picks up the battle screen.
    if (i % 5 === 4) {
      await page.click('#btnSkip', { timeout: 300 }).catch(() => {});
    }
    await page.waitForTimeout(20);
  }

  return false;
}

async function runBattle(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);

  const MAX_RESTARTS = 2;
  let settled = false;
  for (let attempt = 0; attempt <= MAX_RESTARTS && !settled; attempt++) {
    settled = await attemptBattle(page, url);
  }

  await context.close();

  if (!settled) {
    return {
      ok: false,
      reason: `no fight settled within ${BATTLE_MAX_STEPS} steps, after ${MAX_RESTARTS + 1} attempts`,
      consoleErrors,
      pageErrors,
    };
  }
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'a fight settled (ACCEPTED. in the log) and returned to the room screen', consoleErrors, pageErrors };
}

// ---- Run 3: gun ----

// Installs page-side watchers (test-only) that record whether a reload
// loaded rounds and whether a shot killed a minion, by the start of their
// room notes (js/text.js 'gun.reloaded' / 'gun.killed', read from the page
// so a reworded line doesn't break the test).
async function installGunWatchers(page) {
  await page.evaluate(async () => {
    const { t } = await import('./js/text.js');
    const lead = (k, vars) => t(k, vars).split('@@')[0];
    const reloaded = lead('gun.reloaded', { rounds: '@@' });
    const killed = lead('gun.killed', { gold: '@@' });
    window.__smokeReloaded = false;
    window.__smokeKilled = false;
    const feed = document.getElementById('roomFeedback');
    new MutationObserver(() => {
      const text = feed.textContent;
      if (text.includes(reloaded)) window.__smokeReloaded = true;
      if (text.includes(killed)) window.__smokeKilled = true;
    }).observe(feed, { childList: true, subtree: true, characterData: true });
  });
}

const GUN_MAX_STEPS = 500;

// One attempt: a fresh run with DEV -> Combat on gun and Auto-win on (it
// answers reloads right and stops the damage bar on the weak point). Wander
// as the battle run does; press F whenever the HUD shows an aim %, and R
// every few steps while the chamber isn't full, until a reload loaded and
// a shot killed a minion.
async function attemptGun(page, url) {
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await installGunWatchers(page);
  await turnOnAutoWin(page);
  await page.click('#devCombatBtn');
  await page.click('#devSkipBtn');
  await page.waitForTimeout(200);

  let dir = 0;
  for (let i = 0; i < GUN_MAX_STEPS; i++) {
    const status = await page.evaluate(() => ({
      reloaded: window.__smokeReloaded === true,
      killed: window.__smokeKilled === true,
      inRoom: document.getElementById('roomScreen').classList.contains('show'),
      lost: document.getElementById('loseScreen').classList.contains('show'),
      panel: ['reloadPanel', 'mapQuestionPanel', 'aimPanel'].some(id => !document.getElementById(id).hidden),
      canFire: !document.getElementById('btnFire').disabled && document.getElementById('gunAim').textContent.includes('%'),
      canReload: !document.getElementById('btnReload').disabled,
    }));
    if (status.reloaded && status.killed && status.inRoom && !status.panel) return true;
    if (status.lost) return false;
    // A panel over the map (Auto-win answers it), or the battle screen
    // (the boss, the hunter or an item; Auto-win plays it out).
    if (status.panel || !status.inRoom) {
      await page.waitForTimeout(250);
      continue;
    }
    if (status.canFire) {
      await page.keyboard.press('f');
    } else if (status.canReload && i % 6 === 5) {
      await page.keyboard.press('r');
    } else {
      const blocked = await page.evaluate(
        () => document.getElementById('roomFeedback').innerHTML.includes('block-msg')
      );
      if (blocked) dir = (dir + 1) % ARROW_KEYS.length;
      await page.keyboard.press(i % 5 === 4 ? '.' : ARROW_KEYS[dir]);
    }
    await page.waitForTimeout(40);
  }
  return false;
}

async function runGun(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);

  const MAX_RESTARTS = 2;
  let done = false;
  for (let attempt = 0; attempt <= MAX_RESTARTS && !done; attempt++) {
    done = await attemptGun(page, url);
  }

  await context.close();

  if (!done) {
    return {
      ok: false,
      reason: `no reload and kill within ${GUN_MAX_STEPS} steps, after ${MAX_RESTARTS + 1} attempts`,
      consoleErrors,
      pageErrors,
    };
  }
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'a reload loaded and a shot killed a minion on the map', consoleErrors, pageErrors };
}

// ---- Run 4: real time ----

// The HUD's turn count (render.js writes the world's turns there).
function turnsShown(page) {
  return page.evaluate(() => Number(document.getElementById('turnCount').textContent));
}

// Real time on, then the checks listed in the header. Returns what failed
// ('' when everything held).
async function checkRealTime(page, url) {
  await loadPageAndSet(page, url);
  await page.check('#realTimeToggle');
  await startGameAndWaitForRoom(page);
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devCombatBtn');
  await page.click('#devSkipBtn');

  const step = await page.evaluate(async () => (await import('./js/config.js')).REALTIME_STEP_MS);
  const before = await turnsShown(page);
  await page.waitForTimeout(step * 1.5);
  if (await turnsShown(page) !== before) return 'the clock ran with the DEV panel open';

  await page.click('#devToggleBtn');
  await page.waitForTimeout(step * 2.5);
  const ticked = await turnsShown(page);
  if (ticked - before < 2) return `only ${ticked - before} world turns in ${step * 2.5} ms with no input`;

  const beforeSteps = await turnsShown(page);
  for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(40);
  }
  if (await turnsShown(page) - beforeSteps > 1) return 'the player\'s own steps moved the world';
  if (await page.isHidden('#clockStat')) return 'the NEXT meter is not shown';

  // Arrows pressed faster than REALTIME_WALK_MS take one step at most.
  await page.waitForTimeout(300);
  const where = () => page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return state.floor.playerRow * 1000 + state.floor.playerCol;
  });
  const visited = new Set([await where()]);
  for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
    await page.keyboard.press(k);
    visited.add(await where());
  }
  if (visited.size > 2) return `${visited.size - 1} steps taken inside REALTIME_WALK_MS`;

  await page.keyboard.press('r');
  await page.waitForSelector('#reloadPanel:not([hidden])', { timeout: 2000 });
  await page.keyboard.press('1');
  await page.waitForSelector('#mapQuestionPanel:not([hidden])', { timeout: 2000 });
  const beforeQuestion = await turnsShown(page);
  await page.waitForTimeout(step * 1.5);
  const lost = await page.evaluate(() => document.getElementById('loseScreen').classList.contains('show'));
  if (!lost && await turnsShown(page) === beforeQuestion) return 'the clock stopped while a reload question was open';

  await page.goto(url, { waitUntil: 'load' });
  if (!await page.isChecked('#realTimeToggle')) return 'the Real time option was not remembered';
  return '';
}

async function runRealTime(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkRealTime(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'the clock moved the world, paused for the DEV panel and ran through a reload question', consoleErrors, pageErrors };
}

// ---- Main ----

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
    const url = `http://127.0.0.1:${port}/`;
    await waitForServer(url);

    const browser = await chromium.launch();
    try {
      const skipRoomResult = await runSkipRoom(browser, url);
      const battleResult = await runBattle(browser, url);
      const gunResult = await runGun(browser, url);
      const realTimeResult = await runRealTime(browser, url);

      await browser.close();

      let failed = false;
      for (const [name, result] of [['skip-room', skipRoomResult], ['battle', battleResult], ['gun', gunResult], ['real time', realTimeResult]]) {
        if (result.ok) {
          console.log(`PASS (${name}): ${result.detail}`);
        } else {
          failed = true;
          console.error(`FAIL (${name}): ${result.reason}`);
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
