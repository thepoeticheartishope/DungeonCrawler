// Smoke tests for the Noesis Protocol dungeon crawler.
//
// Run: node tests/smoke.mjs
//
// Starts a static server for this repo, then drives the game in a real
// browser via Playwright (imported from ~/Repo/codecraft-classroom/node_modules
// — do NOT add Playwright or node_modules to this repo) through six runs,
// all picking the built-in "Bible Quiz Bowl" set on the set screen, with Auto-win on:
//
//   1. Skip-room run: one manual step, then "Skip room (dev)" repeatedly to
//      clear the floor, asserting the win or lose screen is reached.
//      A run is 7 floors (opening rest, then depth / rest three times, the
//      last rest being the epilogue), so it takes 7 skips; the cap is 10.
//   2. Battle run: DEV -> Combat back to classic (the gun is the default),
//      skips out of the opening rest (it has no minions), then
//      walks with the arrow keys and "Skip turn" to the boss (beside
//      the start) until it or a minion engages and the battle screen appears, then lets Auto-win settle the
//      fight, asserting an ACCEPTED. line appeared in the encounter log and
//      the game is back on the room screen afterward (classic combat).
//   3. Gun run (the default combat), walks toward the nearest minion, bumping an
//      energy cell to reload and pressing F (SELECT) to fire (Auto-win answers
//      the reload and stops the damage bar on the weak point) until a
//      reload gave energy and a shot killed a minion. Then DEV -> Look
//      forces each stick enemy pose in turn (stickforms.js), drawing each,
//      and DEV -> Tendrils each tendril style.
//   4. Real-time run: Real time on (start screen), gun combat (the default),
//      Auto-win off. With the DEV panel open the clock holds still; closed,
//      the world takes turns with no input; the player's own steps don't
//      add turns, and arrows pressed faster than REALTIME_WALK_MS take one
//      step at most; the NEXT meter shows; and the clock waits while a
//      reload question is open on the ask screen. Then the option is still checked after a reload
//      of the page (it's remembered).
//   5. Simple enemies run: the start screen's Simple enemies on, then the
//      gun run's walk until a reload and a kill; every minion's glyph is
//      'e' (or 'E', its tell), the hunter's 'E', and the option is still checked after a
//      reload of the page (it's remembered).
//   6. Free look run (free look is the default): the gun run's walk until a
//      reload and a kill; a tap on a seen minion aims the light at it and
//      spends no turn. The look stick: a drag aims for free, two taps wait
//      one turn, aimed past the arc one tap turns for one turn; the mouse
//      over the map aims. Then the map is drawn looking ahead, at the arc's
//      edge and past it, saved as noesis-free-look-*.png
//      in the system's temp folder. Then DEV -> Free look off and a few
//      turns played.
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

// Enter, then pick the built-in "Bible Quiz Bowl" on the set screen, which
// starts the run.
async function startGameAndWaitForRoom(page) {
  await page.click('#startBtn');
  const quizBowl = '#pickScreen .set-option[data-set="builtin:bible-quiz-bowl"]';
  await page.waitForSelector(quizBowl, { timeout: 10000 });
  await page.click(quizBowl);
  // Start shows the intro (introview.js, about 5 s) before the
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

// Which arrow (an ARROW_KEYS index) is the first step of the shortest
// walk to the boss, or null with no boss or no way there. The boss's core
// is beside the start (locked core plan), so walking to it is the sure
// way into a fight; wandering the bigger floors can run out of light
// first. Reads the game's own state and whatBlocks() in the page.
async function stepTowardBoss(page) {
  return stepToward(page, 'boss');
}

// The arrow (index into ARROW_KEYS) for the first step of the shortest
// walk to the boss (`goal` 'boss') or the nearest minion ('minion'), or
// null when there is none to walk to.
async function stepToward(page, goal) {
  return page.evaluate(async (goal) => {
    const { state, key } = await import('/js/state.js');
    const { whatBlocks } = await import('/js/passage.js');
    const f = state.floor;
    if (goal === 'boss' && !f.boss) return null;
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // ARROW_KEYS order: up, right, down, left
    const first = new Map([[key(f.playerRow, f.playerCol), null]]);
    const queue = [{ row: f.playerRow, col: f.playerCol }];
    while (queue.length) {
      const cur = queue.shift();
      for (let d = 0; d < dirs.length; d++) {
        const next = { row: cur.row + dirs[d][0], col: cur.col + dirs[d][1] };
        const k = key(next.row, next.col);
        if (first.has(k)) continue;
        const step = first.get(key(cur.row, cur.col)) ?? d;
        const at = p => p && next.row === p.row && next.col === p.col;
        if (goal === 'boss' ? at(f.boss) : f.minions.some(at)) return step;
        if (whatBlocks(next.row, next.col)) continue;
        first.set(k, step);
        queue.push(next);
      }
    }
    return null;
  }, goal);
}

// One attempt: load a fresh run, turn on Auto-win, and walk to the boss
// (or wander: arrow keys, falling back to "Skip turn" when blocked) until
// a fight is seen through to settlement, or the step budget runs out.
async function attemptBattle(page, url) {
  await loadPageAndSet(page, url);
  await installBattleWatchers(page);
  await startGameAndWaitForRoom(page);
  await turnOnAutoWin(page);
  // The gun is the default (gun plan step 9): DEV -> Combat back to classic,
  // so a minion that reaches the player opens the battle screen.
  await page.click('#devCombatBtn');
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
    const toBoss = await stepTowardBoss(page);
    await page.keyboard.press(ARROW_KEYS[toBoss ?? dir]);
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
// gave energy and whether a shot killed a minion, by the start of their
// room notes (js/text.js 'gun.reloaded' / 'gun.killed', read from the page
// so a reworded line doesn't break the test).
async function installGunWatchers(page) {
  await page.evaluate(async () => {
    const { t } = await import('./js/text.js');
    const { state } = await import('./js/state.js');
    const { canShoot } = await import('./js/sight.js');
    // Whether the gun has a target it can shoot (the HUD no longer shows an aim %).
    window.__smokeCanFire = () => Boolean(state.floor.gunTarget && canShoot(state.floor.gunTarget));
    const lead = (k, vars) => t(k, vars).split('@@')[0];
    const reloaded = lead('gun.reloaded', { energy: '@@' });
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

// Puts the player on the open tile south of an unused energy cell, facing
// it, and bumps it (ArrowUp), which opens the reload panel: energy comes
// only from drums. Walking there would take a pathfinder; the bump is what
// is being checked. Returns false if no drum could be reached that way.
async function bumpEnergyCell(page) {
  const placed = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { whatBlocks } = await import('./js/passage.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const drum = f.props.find(p => p.kind === 'cell' && !p.searched && !whatBlocks(p.row + 1, p.col));
    if (!drum) return false;
    f.playerRow = drum.row + 1;
    f.playerCol = drum.col;
    f.facing = 'N';
    f.look = 0;
    computeVisibility();
    return true;
  });
  if (placed) await page.keyboard.press('ArrowUp');
  return placed;
}

// One attempt: a fresh run with the gun (the default) and Auto-win on (it
// answers reloads right and stops the damage bar on the weak point). Wander
// as the battle run does; press F (SELECT) whenever the target can be shot,
// and bump an energy cell every few steps while energy isn't full,
// until a reload loaded and a shot killed a minion.
async function attemptGun(page, url, simpleEnemies = false) {
  await loadPageAndSet(page, url);
  if (simpleEnemies) await page.check('#simpleEnemiesToggle');
  await startGameAndWaitForRoom(page);
  await installGunWatchers(page);
  await turnOnAutoWin(page);
  await page.click('#devSkipBtn');
  await page.waitForTimeout(200);

  let dir = 0;
  for (let i = 0; i < GUN_MAX_STEPS; i++) {
    const status = await page.evaluate(() => ({
      reloaded: window.__smokeReloaded === true,
      killed: window.__smokeKilled === true,
      inRoom: document.getElementById('roomScreen').classList.contains('show'),
      lost: document.getElementById('loseScreen').classList.contains('show'),
      panel: ['reloadPanel', 'askQuestionPanel', 'aimPanel'].some(id => !document.getElementById(id).hidden),
      canFire: !document.getElementById('btnSelect').disabled && window.__smokeCanFire(),
      canReload: !document.getElementById('energyCount').textContent.endsWith('#'),
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
    } else if (status.canReload && i % 6 === 5 && await bumpEnergyCell(page)) {
      await page.waitForTimeout(100);
    } else {
      // Walk toward the nearest minion (a fixed plan can put them far from
      // the start, out of reach of a blind wander); wander when none is left.
      const toMinion = await stepToward(page, 'minion');
      const blocked = await page.evaluate(
        () => document.getElementById('roomFeedback').innerHTML.includes('block-msg')
      );
      if (blocked) dir = (dir + 1) % ARROW_KEYS.length;
      await page.keyboard.press(i % 5 === 4 ? '.' : ARROW_KEYS[toMinion ?? dir]);
    }
    await page.waitForTimeout(40);
  }
  return false;
}

// Clicks DEV -> Look through every pose and DEV -> Tendrils through
// every style, each back to random, letting the map draw each one.
// Returns how many looks it went through.
async function cycleLooks(page) {
  if (!await page.isVisible('#devPanel.show')) await page.click('#devToggleBtn');
  const counts = await page.evaluate(async () => {
    const { STICK_POSE_IDS, TENDRIL_STYLES } = await import('./js/stickforms.js');
    return [STICK_POSE_IDS.length, TENDRIL_STYLES.length];
  });
  for (const [button, count] of [['#devLookBtn', counts[0]], ['#devTendrilsBtn', counts[1]]]) {
    for (let i = 0; i <= count; i++) {
      await page.click(button);
      await page.waitForTimeout(150);
    }
  }
  return counts[0] + counts[1] + 2;
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
  const looks = done ? await cycleLooks(page) : 0;

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
  return { ok: true, detail: `a reload loaded and a shot killed a minion on the map; DEV -> Look drew ${looks} looks`, consoleErrors, pageErrors };
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
  // All six go in at once, in the page, so the test's own round trips
  // can't stretch them past the walk window (pressing them one by one
  // from here took 400-600 ms, room for a second, allowed step).
  await page.waitForTimeout(300);
  const visited = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const where = () => state.floor.playerRow * 1000 + state.floor.playerCol;
    const seen = new Set([where()]);
    for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      seen.add(where());
    }
    return seen.size;
  });
  if (visited > 2) return `${visited - 1} steps taken inside REALTIME_WALK_MS`;

  await page.waitForTimeout(300);
  if (!await bumpEnergyCell(page)) return 'no energy cell to reload from';
  await page.waitForSelector('#reloadPanel:not([hidden])', { timeout: 2000 });
  await page.keyboard.press('1');
  await page.waitForSelector('#askQuestionPanel:not([hidden])', { timeout: 2000 });
  const beforeQuestion = await turnsShown(page);
  await page.waitForTimeout(step * 1.5);
  if (await turnsShown(page) !== beforeQuestion) return 'the clock ran while a reload question was open';

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
  return { ok: true, detail: 'the clock moved the world and waited for the DEV panel and a reload question', consoleErrors, pageErrors };
}

// ---- Run 5: simple enemies ----

// The gun run with Simple enemies on, then the checks listed in the
// header. Returns what failed ('' when everything held).
async function checkSimpleEnemies(page, url) {
  const MAX_RESTARTS = 2;
  let done = false;
  for (let attempt = 0; attempt <= MAX_RESTARTS && !done; attempt++) {
    done = await attemptGun(page, url, true);
  }
  if (!done) return `no reload and kill within ${GUN_MAX_STEPS} steps, after ${MAX_RESTARTS + 1} attempts`;

  const glyphs = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { glyphOf } = await import('./js/mapview.js');
    return state.floor.minions.map(m => [m.kind, glyphOf(m)]);
  });
  const odd = glyphs.filter(([kind, g]) => kind === 'hunter' ? g !== 'E' : g !== 'e' && g !== 'E');
  if (odd.length) return `minion glyphs ${JSON.stringify(odd)} with Simple enemies on`;

  await page.goto(url, { waitUntil: 'load' });
  if (!await page.isChecked('#simpleEnemiesToggle')) return 'the Simple enemies option was not remembered';
  return '';
}

async function runSimpleEnemies(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkSimpleEnemies(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'minions showed as e, a shot killed one, and the option was remembered', consoleErrors, pageErrors };
}

// ---- Run 6: free look ----

// Free look (on by default): the gun run's walk until a reload and a
// kill. Then a minion's tile is tapped through the real rule (gun.js
// pickTarget): the aim goes to it and no turn passes. Then the look stick
// and the map are checked (lookControls), pictures are taken (lookShots),
// and with DEV -> Free look off a few turns are played.
async function checkFreeLook(page, url) {
  const MAX_RESTARTS = 2;
  let done = false;
  for (let attempt = 0; attempt <= MAX_RESTARTS && !done; attempt++) {
    done = await attemptGun(page, url);
  }
  if (!done) return `no reload and kill within ${GUN_MAX_STEPS} steps, after ${MAX_RESTARTS + 1} attempts`;
  const tap = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { pickTarget } = await import('./js/gun.js');
    const f = state.floor;
    if (!state.settings.freeLook) return 'free look did not switch on';
    f.look = 0;
    const turns = state.run.turnCount;
    const m = f.minions.find(x => x.kind === 'minion' && f.visibleSet.has(x.row + ',' + x.col));
    if (!m) return '';
    pickTarget({ row: m.row, col: m.col });
    const aim = Math.atan2(m.col - f.playerCol, -(m.row - f.playerRow));
    if (Math.abs(Math.atan2(Math.sin(f.look - aim), Math.cos(f.look - aim))) > 1e-6) return 'a tap did not aim the light at the minion';
    if (state.run.turnCount !== turns) return 'aiming spent a turn';
    return '';
  });
  if (tap) return tap;
  const controls = await lookControls(page);
  if (controls) return controls;
  const shots = await lookShots(page);
  if (shots) return shots;
  return await playWithoutFreeLook(page);
}

// The look's state now: { look, facing, turns, wants }.
function lookNow(page) {
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { wantsTurn } = await import('./js/look.js');
    return { look: state.floor.look, facing: state.floor.facing, turns: state.run.turnCount, wants: wantsTurn() };
  });
}

// Waits until the room screen takes input again (no panel, no turn).
async function roomIdle(page) {
  await page.waitForFunction(async () => {
    const { state } = await import('./js/state.js');
    return document.getElementById('roomScreen').classList.contains('show') && !state.run.turnLocked &&
      ['reloadPanel', 'askQuestionPanel', 'aimPanel'].every(id => document.getElementById(id).hidden);
  }, null, { timeout: 10000 });
}

// The look stick (dpad.js initLookStick) and the map with a mouse: a
// drag aims and spends no turn; two taps wait one turn; aimed past the
// arc (E pressed 5 times), one tap (wobbling 8 px, as a finger does) turns
// the body for one turn; the mouse
// over the map aims.
async function lookControls(page) {
  if (await page.isVisible('#devPanel.show')) await page.click('#devToggleBtn');
  await roomIdle(page);
  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle());
  });
  const stick = await page.locator('#btnSkip').boundingBox();
  const cx = stick.x + stick.width / 2;
  const cy = stick.y + stick.height / 2;
  let before = await lookNow(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 10, cy, { steps: 3 });
  await page.mouse.move(cx + 24, cy, { steps: 3 });
  await page.mouse.up();
  let after = await lookNow(page);
  if (after.look === before.look) return 'dragging the look stick did not aim';
  if (after.turns !== before.turns) return 'dragging the look stick spent a turn';

  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle());
  });
  before = await lookNow(page);
  await page.click('#btnSkip');
  await page.click('#btnSkip');
  await roomIdle(page);
  after = await lookNow(page);
  if (after.turns !== before.turns + 1) return `two taps on the look stick passed ${after.turns - before.turns} turns, not 1`;

  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle());
  });
  for (let i = 0; i < 5; i++) await page.keyboard.press('e'); // 5 nudges of 15°: past the arc
  before = await lookNow(page);
  if (!before.wants) return 'aiming past the arc did not want a turn';
  if (!await page.locator('#btnSkip.armed').count()) return 'the look stick was not lit past the arc';
  // A tap that wobbles a little, as a finger's does, is still a tap.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 6, cy + 5, { steps: 2 });
  await page.mouse.up();
  await roomIdle(page);
  after = await lookNow(page);
  if (after.facing === before.facing) return 'one tap past the arc did not turn the body';
  if (after.turns !== before.turns + 1) return `turning passed ${after.turns - before.turns} turns, not 1`;

  const map = await page.locator('#mapCanvas').boundingBox();
  before = await lookNow(page);
  await page.mouse.move(map.x + map.width * 0.15, map.y + map.height * 0.2);
  await page.mouse.move(map.x + map.width * 0.85, map.y + map.height * 0.8, { steps: 4 });
  after = await lookNow(page);
  if (after.look === before.look) return 'the mouse over the map did not aim';
  if (after.turns !== before.turns) return 'the mouse over the map spent a turn';
  return '';
}

// DEV -> Free look off, then a few waits and arrow presses: the light
// is straight ahead again and nothing breaks.
async function playWithoutFreeLook(page) {
  await page.evaluate(() => document.getElementById('devFreeLookBtn').click());
  for (const k of ['.', 'ArrowLeft', '.', 'ArrowUp', 'ArrowRight']) {
    await roomIdle(page);
    await page.keyboard.press(k);
    await page.waitForTimeout(80);
  }
  const off = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { lookAngle, bodyAngle } = await import('./js/look.js');
    return !state.settings.freeLook && lookAngle() === bodyAngle();
  });
  return off ? '' : 'with free look off the light was not straight ahead';
}

// Aims straight ahead, at the edge of the free arc, and past it, drawing each and saving a picture of the map to the system's
// temp folder for a look by eye. Past the arc a turn must be wanted.
async function lookShots(page) {
  for (const [name, offset] of [['ahead', 0], ['edge', 30], ['past', 100]]) {
    const wants = await page.evaluate(async (deg) => {
      const { state } = await import('./js/state.js');
      const { aimLook, bodyAngle, wantsTurn } = await import('./js/look.js');
      const { requestMapDraw } = await import('./js/mapview.js');
      aimLook(bodyAngle() + deg * Math.PI / 180);
      requestMapDraw();
      return state.settings.freeLook && wantsTurn();
    }, offset);
    if (wants !== (offset > 30)) return `aiming ${offset}° off the body: wantsTurn was ${wants}`;
    await page.waitForTimeout(400);
    await page.locator('#mapCanvas').screenshot({ path: path.join(os.tmpdir(), `noesis-free-look-${name}.png`) });
  }
  return '';
}

async function runFreeLook(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkFreeLook(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'a shot killed a minion, a tap and the mouse aimed, the look stick aimed, waited and turned, and free look off played', consoleErrors, pageErrors };
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
    // ?dev: the DEV tools these runs use are hidden without it.
    const url = `http://127.0.0.1:${port}/?dev`;
    await waitForServer(url);

    const browser = await chromium.launch();
    try {
      const skipRoomResult = await runSkipRoom(browser, url);
      const battleResult = await runBattle(browser, url);
      const gunResult = await runGun(browser, url);
      const realTimeResult = await runRealTime(browser, url);
      const simpleResult = await runSimpleEnemies(browser, url);
      const freeLookResult = await runFreeLook(browser, url);

      await browser.close();

      let failed = false;
      for (const [name, result] of [['skip-room', skipRoomResult], ['battle', battleResult], ['gun', gunResult], ['real time', realTimeResult], ['simple enemies', simpleResult], ['free look', freeLookResult]]) {
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
