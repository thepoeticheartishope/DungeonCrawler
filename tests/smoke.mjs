// Smoke tests for the Noesis Protocol dungeon crawler.
//
// Run: node tests/smoke.mjs
//
// Starts a static server for this repo, then drives the game in a real
// browser via Playwright (imported from ~/Repo/codecraft-classroom/node_modules
// — do NOT add Playwright or node_modules to this repo) through its runs,
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
//      spends no turn. The look stick: a drag aims for free, two taps spend
//      nothing and a 1 s hold (wobbling, as a finger does) waits
//      one turn, aimed past the arc one tap turns for one turn; the mouse
//      over the map aims. Then the map is drawn looking ahead, at the arc's
//      edge and past it, saved as noesis-free-look-*.png
//      in the system's temp folder. Then DEV -> Free look off and a few
//      turns played.
//   7. Light battery run: the battery reads LIGHT #### ON at the foot of
//      the map; V switches it off (only the small circle lit, no turn spent)
//      and on, and so do 3 taps on the look stick; 4 turns on and it dies, refuses V while charging, and is
//      charged again after 4 turns off; a few turns on the first depth with
//      the stick men noticing the light, a shot into the dark (its bar
//      says DARK SHOT), and a stick man alone in the light for 3 s steps
//      closer (the eye). Then Comfort mode (the renamed
//      Simple enemies) on: no battery shown and V does nothing.
//   8. Tutorial run (tutorial.js): on for a new player; wakes dark with
//      "You can't leave. Don't try." and V does nothing; the light falls
//      after 4 waits; walking to it brings "You can do this. I trust you."
//      and the barrel; bumping it asks the name, typed; a name closes the
//      ring of dark ("Die in darkness.", no step out), the kind voice
//      follows ("Don't let them dim your light."), V breaks it: "They'll
//      be listening. Be ready.", the grate shudders a turn
//      later and a stick man drops out of it; one shot (Auto-win stops the
//      bar on a plain hit) drops it ("Finish it.", downed plan) and a bump
//      finishes it; its key opens the door, and through it the opening rest starts
//      with the run's numbers fresh (2 energy), the name kept and the toggle off.
//   9. Answer line run (answer swirl plan steps A and B): Reveal on, Auto-win off,
//      minigames off; a reload from an energy cell answered wrong puts the
//      right answer over the map (#answerNote); a Real-time-free wait
//      fades it and takes it off the map. Then the chest bumped and its
//      question missed: a short answer rings over the chest (swirl.js), a
//      long one is the line, and a wait fades it. Then the same reload
//      miss with Reveal off shows nothing.
//  10. Vents run (vents and noise plan steps B and C): on the first depth
//      the player stands beside a grate and a STALKER beside its pair;
//      a mistake's sound (noise.js makeNoise, called in the page) reaches
//      it through the duct, and waits play it in, the far grate's shudder
//      ("The grate shudders." in the room log), then out beside the
//      player's grate.
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

// Loads the page fresh, ready for #startBtn, with the tutorial room off
// (it is on for a new player; the tutorial run plays it).
async function loadPageAndSet(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
  await page.uncheck('#tutorialToggle');
}

// Enter, then pick the built-in "Bible Quiz Bowl" on the set screen, which
// starts the run.
async function startGameAndWaitForRoom(page) {
  await page.click('#startBtn');
  const quizBowl = '#pickScreen .set-option[data-set="builtin:bible-quiz-bowl"]';
  await page.waitForSelector(quizBowl, { timeout: 10000 });
  await page.click(quizBowl);
  // Start shows the intro (introview.js, about 9 s). A tap skips it, as a
  // player can: waiting it out ran close to the timeout on a busy machine.
  // If it ends on its own first, there's nothing left to tap.
  await page.waitForSelector('#introGlitch.show', { timeout: 10000 });
  await page.click('#introGlitch', { timeout: 3000 }).catch(() => {});
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
  await page.click('#btnU');

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
// The keys that walk grid north, east, south and west: since the eight
// ways plan the arrows walk by screen (up = grid NW), and the number pad
// steps at once with no wait for a second arrow.
const ARROW_KEYS = ['Numpad9', 'Numpad3', 'Numpad1', 'Numpad7'];

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
// it, and bumps it (number pad 9, screen up-right = grid north), which opens the reload panel: energy comes
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
  if (placed) await page.keyboard.press('Numpad9');
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
  // The walk never switches the light, so the battery is left out (the
  // light battery run plays it); otherwise the light dies in 4 turns.
  if (!simpleEnemies) await page.click('#devLightBatteryBtn');
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
      document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
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
    const { seesEnemy } = await import('./js/sight.js');
    const f = state.floor;
    if (!state.settings.freeLook) return 'free look did not switch on';
    f.look = 0;
    const turns = state.run.turnCount;
    const m = f.minions.find(x => x.kind === 'minion' && seesEnemy(x));
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
// drag aims and spends no turn; two taps spend nothing; a hold of
// LOOK_STICK_HOLD_MS, wobbling, waits one turn; aimed past the
// arc (E pressed 5 times), one tap (wobbling 8 px, as a finger does) turns
// the body for one turn; the mouse
// over the map aims.
async function lookControls(page) {
  if (await page.isVisible('#devPanel.show')) await page.click('#devToggleBtn');
  // No minions from here on: the waited and turned turns below would let
  // one move, and a key pressed while its move settles is dropped.
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.floor.minions = [];
    state.floor.hunter = null;
  });
  await roomIdle(page);
  // Aimed a little off the body, so a drag straight right (which is a
  // way the body can face since the eight ways plan) still moves the aim.
  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle() + 0.2);
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
  await page.waitForTimeout(100);
  after = await lookNow(page);
  if (after.turns !== before.turns) return `two taps on the look stick passed ${after.turns - before.turns} turns, not 0`;
  await page.waitForTimeout(500); // past the taps' count
  const holdMs = await page.evaluate(async () => (await import('./js/config.js')).LOOK_STICK_HOLD_MS);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 6, cy + 5, { steps: 2 });
  if (!await page.locator('#btnSkip.holding').count()) return 'holding the look stick showed no ring';
  await page.waitForTimeout(holdMs + 150);
  await page.mouse.up();
  await roomIdle(page);
  after = await lookNow(page);
  if (after.turns !== before.turns + 1) return `holding the look stick passed ${after.turns - before.turns} turns, not 1`;

  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle());
  });
  await roomIdle(page);
  for (let i = 0; i < 5; i++) { // 5 nudges of 15°: past the arc
    await roomIdle(page);
    await page.keyboard.press('e');
  }
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

// Eight ways plan step B, on a phone-sized screen: the square pad fits
// (swap sides off and on), two arrows together walk a diagonal, a corner
// button and the number pad walk by screen, and DEV -> 8 ways off turns
// the pad back with the arrows walking as before. Minions are cleared and
// the player put on an open tile so every press is a real step.
async function checkEightWays(page) {
  await loadPageAndSet(page, page.url());
  await startGameAndWaitForRoom(page);
  await roomIdle(page);
  const width = page.viewportSize().width;
  for (const swapped of [false, true]) {
    await page.evaluate((on) => document.querySelector('.room-controls').classList.toggle('dpad-right', on), swapped);
    const pad = await page.locator('#dpad').boundingBox();
    const buttons = await page.locator('.room-buttons').boundingBox();
    if (pad.x < 0 || pad.x + pad.width > width) return `the pad runs off a ${width} px screen (swap ${swapped})`;
    if (buttons.x < 0 || buttons.x + buttons.width > width) return `MAP / LOG run off a ${width} px screen (swap ${swapped})`;
    if (pad.width < 180) return `the pad is only ${pad.width} px wide`;
    await page.locator('.room-controls').screenshot({ path: path.join(os.tmpdir(), `noesis-eight-ways-pad${swapped ? '-swapped' : ''}.png`) });
  }
  await page.evaluate(() => document.querySelector('.room-controls').classList.remove('dpad-right'));

  const place = () => page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { whatBlocks } = await import('./js/passage.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    f.minions = [];
    f.hunter = null;
    // Props don't count: the spot's own are cleared below. A small rest
    // room with a few props sometimes had no clear 3 x 3 spot at all.
    const blocked = (r, c) => { const b = whatBlocks(r, c); return b && b.kind !== 'prop'; };
    const open = (r, c) => !blocked(r, c) && !(f.stairs && f.stairs.row === r && f.stairs.col === c);
    for (let r = 2; r < f.GRID_SIZE - 2; r++) {
      for (let c = 2; c < f.GRID_SIZE - 2; c++) {
        let clear = true;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) clear = clear && open(r + dr, c + dc);
        if (!clear) continue;
        f.props = f.props.filter(p => Math.abs(p.row - r) > 1 || Math.abs(p.col - c) > 1);
        f.playerRow = r;
        f.playerCol = c;
        f.facing = 'NW';
        f.look = -Math.PI / 4;
        computeVisibility();
        return true;
      }
    }
    return false;
  });
  const where = () => page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return { row: state.floor.playerRow, col: state.floor.playerCol, facing: state.floor.facing };
  });
  const tryStep = async (press, want, label) => {
    if (!await place()) return 'no open 3 x 3 spot on the floor';
    const before = await where();
    await press();
    await page.waitForTimeout(150);
    await roomIdle(page);
    const after = await where();
    const moved = [after.row - before.row, after.col - before.col];
    if (after.facing !== want.facing || moved[0] !== want.step[0] || moved[1] !== want.step[1]) {
      return `${label}: went ${moved} facing ${after.facing}, not ${want.step} facing ${want.facing}`;
    }
    return '';
  };
  const chord = async () => {
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('ArrowRight');
  };
  const checks = [
    [chord, { step: [-1, 0], facing: 'N' }, 'up + right keys'],
    [() => page.keyboard.press('ArrowUp'), { step: [-1, -1], facing: 'NW' }, 'up key'],
    [() => page.click('#btnDL'), { step: [1, 0], facing: 'S' }, 'down-left button'],
    [() => page.click('#btnR'), { step: [-1, 1], facing: 'NE' }, 'right button'],
    [() => page.keyboard.press('Numpad7'), { step: [0, -1], facing: 'W' }, 'number pad 7'],
  ];
  for (const [press, want, label] of checks) {
    const failed = await tryStep(press, want, label);
    if (failed) return failed;
  }

  await page.evaluate(() => document.getElementById('devEightWaysBtn').click());
  if (!await page.locator('#dpad.four-ways').count()) return 'DEV -> 8 ways off did not turn the pad back';
  const old = await tryStep(() => page.keyboard.press('ArrowUp'), { step: [-1, 0], facing: 'N' }, '8 ways off, up key');
  if (old) return old;
  await page.locator('.room-controls').screenshot({ path: path.join(os.tmpdir(), 'noesis-eight-ways-pad-four.png') });
  return '';
}

async function runEightWays(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  await page.goto(url, { waitUntil: 'load' });
  const failure = await checkEightWays(page);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'the square pad fit a phone, keys, chord, buttons and number pad walked by screen, and 8 ways off walked as before', consoleErrors, pageErrors };
}

// ---- Run 7: light battery ----

// The battery's text at the foot of the map, or null while it's hidden.
function batteryShown(page) {
  return page.evaluate(() => {
    const el = document.getElementById('lightBattery');
    return el.hidden ? null : el.textContent;
  });
}

// The newest note in the room log.
function lastNote(page) {
  return page.evaluate(() => document.getElementById('roomFeedback').lastElementChild?.dataset.text || '');
}

// The checks listed in the header. Returns what failed ('' when all held).
async function checkLightBattery(page, url) {
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await roomIdle(page);
  const wait = async (turns) => {
    for (let i = 0; i < turns; i++) {
      await page.keyboard.press('.');
      await roomIdle(page);
    }
  };
  const lit = () => page.evaluate(async () => (await import('./js/state.js')).state.floor.sightSet.size);

  if (await batteryShown(page) !== 'LIGHT #### ON') return `the battery read ${await batteryShown(page)} at the start`;
  const litOn = await lit();
  const turns = await turnsShown(page);
  await page.keyboard.press('v');
  if (await batteryShown(page) !== 'LIGHT #### OFF') return `V left the battery reading ${await batteryShown(page)}`;
  if (await turnsShown(page) !== turns) return 'switching the light spent a turn';
  if (await lit() > 9 || await lit() >= litOn) return `${await lit()} tiles lit with the light off (${litOn} on)`;
  if (!(await lastNote(page)).startsWith('Light off')) return `switching off said "${await lastNote(page)}"`;
  await page.keyboard.press('v');
  if (await batteryShown(page) !== 'LIGHT #### ON') return `V again left ${await batteryShown(page)}`;
  // 3 taps on the look stick switch it too, and spend no turn.
  for (const want of ['OFF', 'ON']) {
    for (let i = 0; i < 3; i++) await page.click('#btnSkip');
    if (await batteryShown(page) !== 'LIGHT #### ' + want) return `3 taps on the stick left ${await batteryShown(page)}`;
    await page.waitForTimeout(500);
  }
  if (await turnsShown(page) !== turns) return 'tapping the stick spent a turn';

  await wait(3);
  if (await batteryShown(page) !== 'LIGHT #--- ON') return `3 turns on left ${await batteryShown(page)}`;
  await wait(1);
  if (await batteryShown(page) !== 'LIGHT ---- EMPTY') return `4 turns on left ${await batteryShown(page)}`;
  if (!(await page.evaluate(() => document.getElementById('roomFeedback').textContent)).includes('Your light dies.')) return 'no "Your light dies." in the log';
  await page.keyboard.press('v');
  if (await lastNote(page) !== 'No light until it is full. 4 more turns.') return `V while empty said "${await lastNote(page)}"`;
  if (await batteryShown(page) !== 'LIGHT ---- EMPTY') return `V while empty left ${await batteryShown(page)}`;
  await wait(4);
  if (await batteryShown(page) !== 'LIGHT #### OFF') return `4 turns off left ${await batteryShown(page)}`;
  if (!(await page.evaluate(() => document.getElementById('roomFeedback').textContent)).includes('Your light is charged.')) return 'no "Your light is charged." in the log';
  await page.keyboard.press('v');
  if (await batteryShown(page) !== 'LIGHT #### ON') return `V when charged left ${await batteryShown(page)}`;

  // Down to the first depth, where the stick men notice the light: a few
  // turns with it on and off (any page error fails the run).
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  await page.click('#devToggleBtn');
  await roomIdle(page);
  if (await batteryShown(page) !== 'LIGHT #### ON') return `a new floor's battery read ${await batteryShown(page)}`;
  await wait(2);
  await page.keyboard.press('v');
  await wait(3);
  const known = await page.evaluate(async () => (await import('./js/state.js')).state.floor.minions
    .every(m => m.kind === 'hunter' || (typeof m.track === 'number' && typeof m.drawn === 'boolean')));
  if (!known) return 'a stick man has no track / drawn';
  // The light is off: F fires into the dark, and the bar opens, harder.
  if (await batteryShown(page) !== 'LIGHT #### OFF') return `before the dark shot the battery read ${await batteryShown(page)}`;
  await page.keyboard.press('f');
  await page.waitForSelector('#aimPanel:not([hidden])', { timeout: 5000 });
  const prompt = await page.locator('#aimPrompt').textContent();
  if (!prompt.startsWith('DARK SHOT')) return `the dark shot's bar said "${prompt}"`;
  await page.keyboard.press('f');
  await roomIdle(page);

  // The eye: the light back on and one stick man alone in the cone, 3 tiles
  // or more away; after GAZE_MS of real time it steps closer (or stares).
  await page.keyboard.press('v');
  const placed = await page.evaluate(async () => {
    const { state, key } = await import('./js/state.js');
    const { spawnMinion } = await import('./js/combat.js');
    const { inLookCone } = await import('./js/sight.js');
    const f = state.floor;
    f.minions = [];
    f.hunter = null;
    const spot = [...f.sightSet].map(k => k.split(',').map(Number))
      .find(([r, c]) => Math.max(Math.abs(r - f.playerRow), Math.abs(c - f.playerCol)) >= 3 && inLookCone(r, c) &&
        !f.props.some(p => p.row === r && p.col === c) && !f.keys.some(k => k.row === r && k.col === c));
    if (!spot) return null;
    spawnMinion({ row: spot[0], col: spot[1] }, 'SHARD');
    return spot;
  });
  if (placed) {
    const gazeMs = await page.evaluate(async () => (await import('./js/config.js')).GAZE_MS);
    await page.waitForTimeout(gazeMs + 600);
    const log = await page.evaluate(() => document.getElementById('roomFeedback').textContent);
    if (!log.includes('It comes closer while you look.') && !log.includes('It stares at you.')) return 'the eye did nothing after 3 s in the light';
  }

  await loadPageAndSet(page, url);
  const label = await page.locator('label:has(#simpleEnemiesToggle)').textContent();
  if (!label.includes('Comfort mode')) return `the comfort option reads "${label.trim()}"`;
  await page.check('#simpleEnemiesToggle');
  await startGameAndWaitForRoom(page);
  await roomIdle(page);
  if (await batteryShown(page) !== null) return 'the battery shows in Comfort mode';
  const before = await lit();
  await page.keyboard.press('v');
  await wait(5);
  if (await lit() !== before) return 'the light changed in Comfort mode';
  return '';
}

async function runLightBattery(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkLightBattery(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'V switched the light, the battery died after 4 turns, locked, charged after 4, and Comfort mode kept it always on', consoleErrors, pageErrors };
}

// ---- Main ----

// ---- Run 8: tutorial room ----

// The arrow (ARROW_KEYS index) for the first step of the shortest walk
// onto (or, if it is solid, into) `goal` { row, col }, or null.
async function stepTo(page, goal) {
  return page.evaluate(async (goal) => {
    const { state, key } = await import('/js/state.js');
    const { whatBlocks } = await import('/js/passage.js');
    const f = state.floor;
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    const first = new Map([[key(f.playerRow, f.playerCol), null]]);
    const queue = [{ row: f.playerRow, col: f.playerCol }];
    while (queue.length) {
      const cur = queue.shift();
      for (let d = 0; d < dirs.length; d++) {
        const next = { row: cur.row + dirs[d][0], col: cur.col + dirs[d][1] };
        const k = key(next.row, next.col);
        if (first.has(k)) continue;
        const step = first.get(key(cur.row, cur.col)) ?? d;
        if (next.row === goal.row && next.col === goal.col) return step;
        if (whatBlocks(next.row, next.col)) continue;
        first.set(k, step);
        queue.push(next);
      }
    }
    return null;
  }, goal);
}

// The tutorial's state in the page: { stage, spot, door, barrel, key,
// minion, light, name, toggle, hearts, sense }.
async function tutorialState(page) {
  return page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const f = state.floor;
    const tut = f.tutorial;
    const barrel = f.props.find(p => p.asks === 'name');
    return {
      stage: tut ? tut.stage : null,
      spot: tut && tut.spot, door: tut && tut.door,
      barrel: barrel ? { row: barrel.row, col: barrel.col } : null,
      key: f.keys[0] || null,
      minion: f.minions[0] ? { row: f.minions[0].row, col: f.minions[0].col } : null,
      light: f.light.on,
      name: state.settings.playerName,
      toggle: document.getElementById('tutorialToggle').checked,
      hearts: state.run.hearts, maxHearts: state.run.maxHearts, energy: state.run.energy,
      rest: !!f.exchange,
      sense: document.getElementById('senseNote').textContent,
      ask: !document.getElementById('askQuestionPanel').hidden,
    };
  });
}

// Walks toward `goal` until `done(tutorialState)` is true or `steps` run out.
async function walkUntil(page, goal, done, steps = 40) {
  for (let i = 0; i < steps; i++) {
    const st = await tutorialState(page);
    if (done(st)) return st;
    const dir = await stepTo(page, typeof goal === 'function' ? goal(st) : goal);
    await page.keyboard.press(dir === null ? '.' : ARROW_KEYS[dir]);
    await page.waitForTimeout(60);
  }
  return null;
}

async function checkTutorial(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
  if (!await page.isChecked('#tutorialToggle')) return 'the tutorial was not on for a new player';
  await startGameAndWaitForRoom(page);
  let st = await tutorialState(page);
  if (st.stage !== 'dark') return 'the run did not start in the tutorial room';
  if (!st.sense.includes("can't leave")) return 'no "You can\'t leave." on waking: ' + st.sense;
  await page.keyboard.press('v');
  if ((await tutorialState(page)).light) return 'the light came on in the dark';

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('.');
    await page.waitForTimeout(60);
  }
  st = await tutorialState(page);
  if (st.stage !== 'spot') return 'the light from above did not fall after 4 waits (stage ' + st.stage + ')';
  st = await walkUntil(page, st.spot, s => s.stage === 'name');
  if (!st) return 'walking to the light did not bring the barrel';
  if (!st.sense.includes('trust you')) return 'no kind voice at the light: ' + st.sense;

  st = await walkUntil(page, st.barrel, s => s.ask);
  if (!st) return 'bumping the barrel did not ask anything';
  if (!await page.isVisible('#answerInput')) return 'the barrel gave no box to type the name in';
  await page.fill('#answerInput', 'Smoke');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  st = await tutorialState(page);
  if (st.stage !== 'ring' || st.name !== 'Smoke') return 'the name did not close the ring (stage ' + st.stage + ', name ' + st.name + ')';
  if (!st.sense.includes('Die in darkness')) return 'no "Die in darkness." after the name: ' + st.sense;
  const held = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return [state.floor.playerRow, state.floor.playerCol].join(',');
  });
  await page.keyboard.press(ARROW_KEYS[2]);
  await page.waitForTimeout(200);
  const after = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return [state.floor.playerRow, state.floor.playerCol].join(',');
  });
  if (after !== held) return 'the player stepped out of the ring of dark';
  await page.waitForTimeout(3300);
  st = await tutorialState(page);
  if (!st.sense.includes('dim your light')) return 'no kind voice in the ring: ' + st.sense;
  await page.keyboard.press('v');
  await page.waitForTimeout(200);
  st = await tutorialState(page);
  if (st.stage !== 'fight') return 'the light did not break the ring (stage ' + st.stage + ')';
  if (!st.sense.includes("They'll be listening.")) return 'no "They\'ll be listening." once the ring broke: ' + st.sense;
  if (st.minion) return 'the stick man was on the floor at once, not in the grate';
  // Next turn the grate shudders; the turn after, it drops out.
  await page.keyboard.press('.');
  await page.waitForTimeout(100);
  const shudder = await page.evaluate(() => document.getElementById('roomFeedback').textContent);
  if (!shudder.includes('The grate shudders.')) return 'no shudder from the tutorial grate: ' + shudder;
  await page.keyboard.press('.');
  await page.waitForTimeout(100);
  st = await tutorialState(page);
  if (!st.minion) return 'the stick man did not drop out of the grate';

  // Face the stick man and shoot. Its weak point would kill it outright
  // (2 HP), so the bar loses its weak zones and Auto-win stops it on a
  // plain hit: one hit leaves it on 1 HP and it goes down (downed plan).
  let downed = false;
  for (let i = 0; i < 40 && !downed; i++) {
    // Out of reach, wait for it to come (a blocked shot spends no turn).
    const canShoot = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { BODY_ANGLES } = await import('/js/look.js');
      const { computeVisibility, shootBlock } = await import('/js/sight.js');
      const { refreshGunTarget } = await import('/js/gun.js');
      const f = state.floor;
      const m = f.minions[0];
      if (!m) return false;
      const angle = Math.atan2(m.col - f.playerCol, -(m.row - f.playerRow));
      const off = a => Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
      f.facing = Object.keys(BODY_ANGLES).sort((a, b) => off(BODY_ANGLES[a]) - off(BODY_ANGLES[b]))[0];
      f.look = angle;
      computeVisibility();
      refreshGunTarget();
      return !shootBlock(m);
    });
    await page.keyboard.press(canShoot ? 'f' : '.');
    await page.waitForTimeout(100);
    const aiming = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const aim = state.battle.aim;
      if (aim) aim.zones = aim.zones.filter(z => z.tier !== 'weak');
      return !!aim;
    });
    if (aiming) {
      await turnOnAutoWin(page);
      await page.click('#devToggleBtn');
      await page.waitForTimeout(500);
      await page.click('#devToggleBtn');
      await page.click('#devAutoWinBtn');
      await page.click('#devToggleBtn');
    }
    st = await tutorialState(page);
    if (st.hearts <= 0) return 'the stick man won the tutorial fight';
    downed = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return !!state.floor.minions[0] && state.floor.minions[0].downed;
    });
  }
  if (!downed) return 'one shot did not drop the tutorial stick man (stage ' + st.stage + ')';
  if (!st.sense.includes('Finish it.')) return 'no "Finish it." when the stick man went down: ' + st.sense;
  st = await walkUntil(page, s => s.minion, s => s.stage !== 'fight' || s.hearts <= 0);
  if (!st || st.stage !== 'key') return 'a bump did not finish the downed stick man, or it left no key (stage ' + (st && st.stage) + ')';

  st = await walkUntil(page, st.key, s => s.stage === 'open');
  if (!st) return 'taking the key did not open the door';
  st = await walkUntil(page, st.door, s => s.stage === null);
  if (!st) return 'the open door did not lead out of the tutorial';
  if (!st.rest) return 'leaving the tutorial did not start the opening rest';
  if (st.toggle) return 'the tutorial toggle was not switched off once finished';
  if (st.hearts !== st.maxHearts) return 'the run did not start with full hearts';
  if (st.energy !== 2) return 'the run after the tutorial did not start with 2 energy (' + st.energy + ')';
  if (st.name !== 'Smoke') return 'the name was not kept';
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
  if (await page.isChecked('#tutorialToggle')) return 'the finished tutorial came back on after a reload';
  if (await page.inputValue('#playerName') !== 'Smoke') return 'the name from the barrel was not saved';
  return null;
}

async function runTutorial(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const reason = await checkTutorial(page, url);
  await context.close();
  if (reason) return { ok: false, reason, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'dark, light from above, barrel name, ring broken by the light, grate shudders, stick man drops out, one shot drops it ("Finish it."), a bump finishes it, key, door, out to the opening rest', consoleErrors, pageErrors };
}

// Runs one smoke run. A throw (a Playwright timeout, say) becomes that
// run's FAIL with its first stack line, so it is named in the report and
// the runs after it still go.
// ---- Run 9: the answer line ----

// One miss on a reload: bumps an energy cell, picks the plain reload (1)
// and answers it wrong (a wrong option, or a typed answer that can't be
// right). Returns the right answer, or null if no cell could be bumped.
async function missReload(page) {
  if (!await bumpEnergyCell(page)) return null;
  await page.waitForSelector('#reloadPanel:not([hidden])', { timeout: 5000 });
  await page.keyboard.press('1');
  await page.waitForSelector('#askQuestionPanel:not([hidden])', { timeout: 5000 });
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const right = state.battle.currentQuestion.meaning;
    const wrong = [...document.querySelectorAll('#askQuestionPanel .mc-option')]
      .find(b => b.offsetParent && b.querySelector('.opt-text').textContent !== right);
    if (wrong) wrong.click();
    else {
      const input = document.getElementById('answerInput');
      input.value = 'zzzz';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    return right;
  });
}

// What the answer line shows: its text, and whether it is on the map and lit.
function answerLine(page) {
  return page.evaluate(() => {
    const el = document.getElementById('answerNote');
    return { text: el.textContent, onMap: !el.hidden, lit: el.classList.contains('show') };
  });
}

async function checkAnswerLine(page, url, reveal) {
  await loadPageAndSet(page, url);
  if (reveal) await page.check('#revealToggle');
  else await page.uncheck('#revealToggle');
  await startGameAndWaitForRoom(page);
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  await page.click('#devLightBatteryBtn');
  await page.click('#devToggleBtn');
  await page.evaluate(async () => { (await import('./js/state.js')).state.settings.minigame = 'off'; });
  await page.waitForTimeout(200);

  const right = await missReload(page);
  if (right === null) return { skipped: 'no energy cell to bump' };
  await page.waitForSelector('#askQuestionPanel', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(300);
  const shown = await answerLine(page);
  if (!reveal) return shown.onMap ? 'the answer showed with Reveal off' : { detail: 'no line with Reveal off' };
  if (!shown.onMap || !shown.lit) return 'no answer line after a miss';
  if (shown.text !== right) return `the line says "${shown.text}", the answer is "${right}"`;

  await page.waitForTimeout(1500);
  if (!(await answerLine(page)).lit) return 'the line went before the player moved';
  await page.keyboard.press('.');
  await page.waitForTimeout(200);
  if ((await answerLine(page)).lit) return 'a wait did not fade the line';
  const fade = await page.evaluate(async () => (await import('./js/config.js')).ANSWER_LINE_FADE_MS);
  await page.waitForTimeout(fade + 300);
  if ((await answerLine(page)).onMap) return 'the line stayed on the map after its fade';
  const ring = await checkAnswerRing(page);
  if (typeof ring === 'string') return ring;
  return { detail: `"${right}" showed until a wait, then faded; ${ring.detail}` };
}

// The chest's question missed (answer swirl step B): a short answer rings
// over the chest, a long one shows as the line, and a wait puts it away.
async function checkAnswerRing(page) {
  const placed = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { whatBlocks } = await import('./js/passage.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const chest = f.chest;
    if (!chest) return null;
    // The open side to bump it from, and the number pad key that points at
    // it (screen up-right = grid north).
    const sides = [[1, 0, 'N', 0, 'Numpad9'], [-1, 0, 'S', Math.PI, 'Numpad1'], [0, -1, 'E', Math.PI / 2, 'Numpad3'], [0, 1, 'W', -Math.PI / 2, 'Numpad7']];
    const side = sides.find(([dr, dc]) => !whatBlocks(chest.row + dr, chest.col + dc));
    if (!side) return null;
    f.playerRow = chest.row + side[0];
    f.playerCol = chest.col + side[1];
    f.facing = side[2];
    f.look = side[3];
    computeVisibility();
    return side[4];
  });
  if (!placed) return { detail: 'no chest to bump (ring not checked)' };
  await page.keyboard.press(placed);
  await page.waitForSelector('#battleScreen.show', { timeout: 5000 });
  await page.waitForTimeout(300);
  const right = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const right = state.battle.currentQuestion.meaning;
    const wrong = [...document.querySelectorAll('#battleScreen .mc-option')]
      .find(b => b.offsetParent && b.querySelector('.opt-text').textContent !== right);
    if (wrong) wrong.click();
    else {
      const input = document.getElementById('answerInput');
      input.value = 'zzzz';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    return right;
  });
  // A settled fight waits for Continue before the room comes back.
  await page.click('#continueBtn', { timeout: 5000 });
  await page.waitForSelector('#roomScreen.show', { timeout: 10000 });
  await page.waitForTimeout(300);
  const ringed = () => page.evaluate(async () => {
    const ring = (await import('./js/swirl.js')).answerRingNow(performance.now());
    return ring && { text: ring.text, fading: ring.fading !== null };
  });
  const fits = await page.evaluate(async (a) => (await import('./js/swirl.js')).ringFits(a), right);
  const ring = await ringed();
  const line = await answerLine(page);
  if (fits) {
    if (!ring || ring.text !== right) return `no ring for the short answer "${right}"`;
    if (line.lit) return 'the line showed beside the ring';
  } else {
    if (ring) return `the long answer "${right}" rang`;
    if (!line.lit || line.text !== right) return `no line for the long answer "${right}"`;
  }
  await page.keyboard.press('.');
  await page.waitForTimeout(200);
  if (fits && !(await ringed())?.fading) return 'a wait did not fade the ring';
  if (!fits && (await answerLine(page)).lit) return 'a wait did not fade the line';
  return { detail: `the chest's "${right}" ${fits ? 'rang' : 'showed as the line'} until a wait` };
}

async function runAnswerLine(browser, url) {
  const results = [];
  for (const reveal of [true, false]) {
    // No service worker: on a first visit it takes over and main.js reloads
    // the page, which could swallow the start click or the Reveal toggle.
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors = collectErrors(page);
    // A cell may sit where it can't be bumped from the south; a new run
    // lays the floor out again.
    let res;
    for (let tries = 0; tries < 4; tries++) {
      res = await checkAnswerLine(page, url, reveal);
      if (!res || !res.skipped) break;
    }
    await page.close();
    if (typeof res === 'string') return { ok: false, reason: res, ...errors };
    if (res.skipped) return { ok: false, reason: res.skipped, ...errors };
    if (errors.consoleErrors.length || errors.pageErrors.length) return { ok: false, reason: 'errors on the page', ...errors };
    results.push(res.detail);
  }
  return { ok: true, detail: results.join('; '), consoleErrors: [], pageErrors: [] };
}

async function runVents(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  await page.click('#devToggleBtn');
  await page.waitForTimeout(300);

  // Set the scene through the game's own modules (the page's copies).
  const setUp = await page.evaluate(async () => {
    const { state, key } = await import('/js/state.js');
    const { spawnMinion, neighbors, tileOccupied } = await import('/js/combat.js');
    const { makeNoise } = await import('/js/noise.js');
    const f = state.floor;
    if (f.vents.length < 2) return { error: 'no grates on the first depth' };
    const free = v => neighbors(v.row, v.col).map(([row, col]) => ({ row, col }))
      .find(t => !f.wallSet.has(key(t.row, t.col)) && !tileOccupied(t.row, t.col) && !f.vents.some(o => o.row === t.row && o.col === t.col));
    const near = f.vents[0];
    const far = f.vents[near.pair];
    const stand = free(near);
    if (!stand) return { error: 'no free tile beside the grate' };
    f.playerRow = stand.row;
    f.playerCol = stand.col;
    f.minions = [];
    const spot = free(far);
    if (!spot) return { error: 'no free tile beside its pair' };
    const m = spawnMinion(spot, 'STALKER');
    const heard = makeNoise('gate').some(e => e.type === 'noiseHeard' && e.minion === m);
    return { heard };
  });
  if (setUp.error) return { ok: false, reason: setUp.error, consoleErrors, pageErrors };
  if (!setUp.heard) return { ok: false, reason: 'the STALKER beside the far grate did not hear the sound', consoleErrors, pageErrors };

  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('.');
    await page.waitForTimeout(120);
    seen.push(await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.floor.crawling.length ? 'duct' : 'floor';
    }));
  }
  const log = await page.evaluate(() => document.getElementById('roomFeedback').textContent);
  const out = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const f = state.floor;
    const near = f.vents[0];
    const m = f.minions[0];
    return !!m && Math.max(Math.abs(m.row - near.row), Math.abs(m.col - near.col)) <= 2;
  });
  await context.close();
  if (!seen.includes('duct')) return { ok: false, reason: 'the STALKER never went into the duct: ' + seen.join(' '), consoleErrors, pageErrors };
  if (!log.includes('The grate shudders.')) return { ok: false, reason: 'no shudder in the room log: ' + log, consoleErrors, pageErrors };
  if (!out) return { ok: false, reason: 'the STALKER did not come out by the player\'s grate', consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) return { ok: false, reason: 'errors on the page', consoleErrors, pageErrors };
  return { ok: true, detail: 'a sound by a grate brought a STALKER through the duct: in, a shudder, out beside the player (' + seen.join(' ') + ')', consoleErrors, pageErrors };
}

async function guarded(run, browser, url) {
  try {
    return await run(browser, url);
  } catch (err) {
    const where = String(err.stack || '').split('\n').find(l => l.includes('smoke.mjs')) || '';
    return { ok: false, reason: `${err.message.split('\n')[0]} ${where.trim()}`, consoleErrors: [], pageErrors: [] };
  }
}

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
      const skipRoomResult = await guarded(runSkipRoom, browser, url);
      const battleResult = await guarded(runBattle, browser, url);
      const gunResult = await guarded(runGun, browser, url);
      const realTimeResult = await guarded(runRealTime, browser, url);
      const simpleResult = await guarded(runSimpleEnemies, browser, url);
      const freeLookResult = await guarded(runFreeLook, browser, url);
      const eightWaysResult = await guarded(runEightWays, browser, url);
      const lightBatteryResult = await guarded(runLightBattery, browser, url);
      const tutorialResult = await guarded(runTutorial, browser, url);
      const answerLineResult = await guarded(runAnswerLine, browser, url);
      const ventsResult = await guarded(runVents, browser, url);

      await browser.close();

      let failed = false;
      for (const [name, result] of [['skip-room', skipRoomResult], ['battle', battleResult], ['gun', gunResult], ['real time', realTimeResult], ['simple enemies', simpleResult], ['free look', freeLookResult], ['eight ways', eightWaysResult], ['light battery', lightBatteryResult], ['tutorial', tutorialResult], ['answer line', answerLineResult], ['vents', ventsResult]]) {
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
