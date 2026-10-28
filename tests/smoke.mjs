// Smoke tests for the Noesis Protocol dungeon crawler.
//
// Run: node tests/smoke.mjs (SMOKE_ONLY=answer,tutorial and SMOKE_REPEAT=20
// pick runs and repeat them; see main)
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
//      the reload and starts and stops the dial in its kill zone) until a
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
//      spends no turn. The look stick: a short drag sideways sweeps for
//      free, two taps spend nothing and a 1 s hold (wobbling, as a finger
//      does) waits one turn, a tap on the floor past the arc turns for one turn.
//      Then the map is drawn looking ahead, at the arc's
//      edge and past it, saved as noesis-free-look-*.png
//      in the system's temp folder. Then DEV -> Free look off and a few
//      turns played.
//   7. Light battery run: the battery reads LIGHT #### ON at the foot of
//      the map (the HUD tube's label; its canvas shows 4 lit cells, 1
//      after 3 turns, none empty); V switches it off (only the small circle lit, no turn spent)
//      and on, and so does the LIGHT button (3 taps on the look stick no longer do); 4 turns on and it dies, refuses V while charging, and is
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
//      minigames off, the first depth's stick men cleared; a reload from an energy cell answered wrong puts the
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
//  11. Room view run (room view plan): a phone-sized page on the first
//      depth. Space held fades the room into the sky with the eye for no
//      turn, and letting go brings it back (step F); stood two tiles from a
//      stick man and aimed at it, DEV -> Test shot with Auto-win kills it
//      (step C); then on an open 2 x 2 block every arrow key walks the way
//      it points on screen whichever way the body faces (up is grid north,
//      right grid east), and the map draws. Saved as noesis-room-*.png in
//      the system's temp folder.
//  12. Charger run (charger plan step B): a phone-sized page on the first
//      depth, 0 energy, no stick men; walking into the charger opens
//      CHARGE.SYS over the map (it fits, wires 44 px), 2 wire turns spend 1
//      turn, Escape closes it and a bump opens it on the same wires,
//      solving them fills energy and closes it, a bump at full opens nothing
//      ("nothing to give"); the kind voice's "It still holds a charge."
//      after the first turn beside it; then a hunting stick man beside the player
//      closes it ("It found you."). Saved as noesis-charger*.png.
//  13. One stick run (one stick plan steps A-G): the default (Turns off) on the
//      opening rest; held arrow keys walk the player freely (their spot
//      between tiles, the tile they stand on following it), letting go stops
//      them, and the real-time NEXT meter shows. Step B: a tap only turns,
//      X sneaks slower, and the round stick (in the d-pad's place) walks.
//      Step C: a stick man beside them reaches and strikes; walked away
//      from, it misses ("It misses."). Step D: the battery runs out by
//      time, and the HUD has no turn count. Step E: SELECT opens the dial
//      on a reaching stick man, and the reach waits while it is up.
//  14. Tutorial with One stick (one stick plan step G): the default (Turns
//      off), the arrows held: walking brings the light from above, then
//      the barrel; the name closes the ring, V breaks it, and the stick
//      man's first reach brings "When it reaches, step away.".
//  15. Record book run (record book plan step D), on a phone with One
//      stick: LOG opens the book at its LOG page in the map's place, the
//      newest note first, CLOCK RUNNING and the world still taking turns;
//      the MAP tab turns to the minimap drawn on the page; the same tab
//      again closes it. M opens it at MAP, L turns to LOG, Esc closes it,
//      and walking keys do nothing while it is open.
//  16. Safe room run (safe room plan step B): the turn game on the first
//      depth, its stick men cleared. A SHARD that knows where the player is
//      and is reaching for them follows them to the start room's doorway:
//      stepping onto it breaks the reach. It stops at the open frame, the
//      player pulls the switch ("You pull the shutter down."), it waits
//      ("It waits at the shutter."), gives up ("It's gone.") and never gets
//      in; the kind voice says "Pull the shutter. They won't follow you
//      in." (step C); a bump on the switch rolls the shutter up again. Saved as
//      noesis-safe-room*.png.
//
// Every run plays the room view, the game's only map view since room view
// plan step G (the shoulder view before it is kept outside the repo, at
// ideas/reference/shoulder-view/); run 11 is its own checks.
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
// Opens the start screen with the tutorial off. Every run but the One
// stick ones plays in turns (`turns`, the start screen's Turns option):
// they drive the turn game's rules step by step. One stick, the default
// since one stick plan step G, has its own runs.
async function loadPageAndSet(page, url, { turns = true } = {}) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
  await page.uncheck('#tutorialToggle');
  if (turns) await page.check('#turnsToggle');
  else await page.uncheck('#turnsToggle');
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
// The keys that walk grid north, east, south and west: they walk the way
// they point on screen (room view plan, up = grid north), and the number
// pad steps at once with no wait for a second arrow.
const ARROW_KEYS = ['Numpad8', 'Numpad6', 'Numpad2', 'Numpad4'];

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
  if (placed) await page.keyboard.press('Numpad8');
  return placed;
}

// One attempt: a fresh run with the gun (the default) and Auto-win on (it
// answers reloads right and starts and stops the dial in its kill zone). Wander
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

// The look stick (dpad.js initLookStick): a short drag sideways sweeps
// the light inside the free arc and spends no turn; two taps spend
// nothing; a hold of LOOK_STICK_HOLD_MS, wobbling, waits one turn; a
// tap on the floor past the arc turns the body for one turn.
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
  // Aimed a little left of the body, so a short drag right sweeps the
  // light inside the free arc (a sweep past it turns the body, a turn).
  await page.evaluate(async () => {
    const { aimLook, bodyAngle } = await import('./js/look.js');
    aimLook(bodyAngle() - 0.3);
  });
  const stick = await page.locator('#btnSkip').boundingBox();
  const cx = stick.x + stick.width / 2;
  const cy = stick.y + stick.height / 2;
  let before = await lookNow(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 10, cy, { steps: 2 });
  await page.mouse.move(cx + 18, cy, { steps: 2 });
  await page.waitForTimeout(150); // the sweep runs while it is held
  await page.mouse.up();
  await page.waitForTimeout(100);
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

  // A tap on the floor past the free arc (near the map's bottom-right
  // corner, close beside the player) turns the body there at once, for
  // one turn: the turn is spent at once,
  // with nothing left waiting for the stick's tap.
  const map = await page.locator('#mapCanvas').boundingBox();
  before = await lookNow(page);
  await page.mouse.click(map.x + map.width * 0.97, map.y + map.height * 0.97);
  await roomIdle(page);
  after = await lookNow(page);
  if (after.facing === before.facing) return 'a tap on the floor past the arc did not turn the body';
  if (after.turns !== before.turns + 1) return `turning passed ${after.turns - before.turns} turns, not 1`;
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
  return { ok: true, detail: 'a shot killed a minion, a tap aimed, the look stick swept, waited and turned, and free look off played', consoleErrors, pageErrors };
}

// Eight ways plan step B, on a phone-sized screen: the square pad fits
// (swap sides off and on); walking goes by the body, all 8 ways: up steps
// the way it faces, E ahead at a slant, down turns round and steps, the
// up-left button ahead at the other slant; and DEV -> 8 ways off turns the
// pad back with up still stepping ahead. Minions are cleared and the
// player put on an open tile, facing NW, so every press is a real step.
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

  let facing = { way: 'NW', look: -Math.PI / 4 };
  const place = () => page.evaluate(async (facing) => {
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
        f.facing = facing.way;
        f.look = facing.look;
        computeVisibility();
        return true;
      }
    }
    return false;
  }, facing);
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
  // Every key and button walks the way it points on screen (up is grid
  // north), whichever way the body faced before.
  const checks = [
    [() => page.keyboard.press('ArrowUp'), { step: [-1, 0], facing: 'N' }, 'up key'],
    [() => page.keyboard.press('e'), { step: [-1, 1], facing: 'NE' }, 'E key'],
    [() => page.keyboard.press('ArrowDown'), { step: [1, 0], facing: 'S' }, 'down key'],
    [() => page.click('#btnUL'), { step: [-1, -1], facing: 'NW' }, 'up-left button'],
    [() => page.keyboard.press('c'), { step: [1, 1], facing: 'SE' }, 'C key'],
  ];
  for (const [press, want, label] of checks) {
    const failed = await tryStep(press, want, label);
    if (failed) return failed;
  }

  await page.evaluate(() => document.getElementById('devEightWaysBtn').click());
  if (!await page.locator('#dpad.four-ways').count()) return 'DEV -> 8 ways off did not hide the pad\'s corners';
  facing = { way: 'N', look: 0 };
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
  return { ok: true, detail: 'the square pad fit a phone, keys and buttons walked the way they point on screen all 8 ways, and 8 ways off walked ahead', consoleErrors, pageErrors };
}

// ---- Run 7: light battery ----

// The battery's words at the foot of the map (the tube's label, read out
// by screen readers), or null while it's hidden.
function batteryShown(page) {
  return page.evaluate(() => {
    const el = document.getElementById('lightBattery');
    return el.hidden ? null : el.getAttribute('aria-label');
  });
}

// How many of the HUD tube's cells are drawn lit (record book plan step
// E): the middle of each cell along the tube on its side, cap on the left,
// read off its canvas. The stored colour is dim, so this counts only with
// the light on and warmed up.
function tubeLitCells(page) {
  return page.evaluate(async () => {
    const { TUBE_W } = await import('./js/tubeart.js');
    const canvas = document.getElementById('hudTube');
    const ctx = canvas.getContext('2d');
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const [r] = ctx.getImageData(23 + 22 * i, Math.floor(TUBE_W / 4), 1, 1).data;
      if (r > 150) n++;
    }
    return n;
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
  if (await tubeLitCells(page) !== 4) return `the HUD tube showed ${await tubeLitCells(page)} lit cells at the start`;
  const litOn = await lit();
  const turns = await turnsShown(page);
  await page.keyboard.press('v');
  if (await batteryShown(page) !== 'LIGHT #### OFF') return `V left the battery reading ${await batteryShown(page)}`;
  if (await turnsShown(page) !== turns) return 'switching the light spent a turn';
  if (await lit() > 9 || await lit() >= litOn) return `${await lit()} tiles lit with the light off (${litOn} on)`;
  if (!(await lastNote(page)).startsWith('Light off')) return `switching off said "${await lastNote(page)}"`;
  await page.keyboard.press('v');
  if (await batteryShown(page) !== 'LIGHT #### ON') return `V again left ${await batteryShown(page)}`;
  // 3 taps on the look stick no longer switch it (the LIGHT button does).
  for (let i = 0; i < 3; i++) await page.click('#btnSkip');
  if (await batteryShown(page) !== 'LIGHT #### ON') return `3 taps on the stick left ${await batteryShown(page)}`;
  await page.waitForTimeout(500);
  // The LIGHT button under the map switches it too (light button prototype).
  for (const want of ['OFF', 'ON']) {
    await page.click('#lightBattery');
    if (await batteryShown(page) !== 'LIGHT #### ' + want) return `the LIGHT button left ${await batteryShown(page)}`;
  }
  if (await turnsShown(page) !== turns) return 'tapping the stick or the LIGHT button spent a turn';

  await wait(3);
  if (await batteryShown(page) !== 'LIGHT #--- ON') return `3 turns on left ${await batteryShown(page)}`;
  await page.waitForTimeout(800);
  if (await tubeLitCells(page) !== 1) return `the HUD tube showed ${await tubeLitCells(page)} lit cells after 3 turns on`;
  await wait(1);
  if (await batteryShown(page) !== 'LIGHT ---- EMPTY') return `4 turns on left ${await batteryShown(page)}`;
  if (await tubeLitCells(page) !== 0) return 'the HUD tube still showed lit cells when empty';
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
  // turns with it on and off (any page error fails the run). DEV -> Safe
  // room off: the player would start in it, where the lamp switches their
  // light off and it doesn't charge; these are the rules outside it.
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSafeRoomBtn');
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
  // The light is off: F fires into the dark, and the dial opens at READY, harder.
  if (await batteryShown(page) !== 'LIGHT #### OFF') return `before the dark shot the battery read ${await batteryShown(page)}`;
  await page.keyboard.press('f');
  await page.waitForSelector('#aimPanel:not([hidden])', { timeout: 5000 });
  const prompt = await page.locator('#aimPrompt').textContent();
  if (!prompt.startsWith('DARK SHOT')) return `the dark shot's dial said "${prompt}"`;
  await page.keyboard.press('f'); // READY
  await page.waitForTimeout(150);
  await page.keyboard.press('f'); // stop
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

// ---- Run 13: one stick ----

async function runOneStick(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkOneStick(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'held arrows walked freely between tiles, letting go stopped, the NEXT meter showed, a tap turned, X crept, the round stick walked, a reach landed and a dodged one missed, the battery ran out by time, the dial held a reach', consoleErrors, pageErrors };
}

// The player's free spot and tile now.
function spotNow(page) {
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { freeSpot } = await import('./js/walk.js');
    const at = freeSpot();
    return { x: at.x, y: at.y, row: state.floor.playerRow, col: state.floor.playerCol, facing: state.floor.facing };
  });
}

// One stick on the opening rest (no stick men): stands the player at the
// west end of four open tiles in a row, holds → about 1.5 tiles' worth, and
// checks they went east, off the tile centres, with their tile following.
// Returns what failed ('' when all held).
async function checkOneStick(page, url) {
  await loadPageAndSet(page, url, { turns: false });
  await startGameAndWaitForRoom(page);
  if (await page.evaluate(async () => !(await import('./js/state.js')).state.settings.oneStick)) return 'One stick was not the default';
  if (!await placeInRow(page)) return 'no four open tiles in a row on the opening rest';
  await roomIdle(page);
  const start = await spotNow(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  const walked = await spotNow(page);
  if (walked.x - start.x < 0.8) return `held → for 700 ms went only ${(walked.x - start.x).toFixed(2)} tiles`;
  if (walked.y !== start.y) return 'walking east moved the player up or down';
  if (walked.col !== Math.floor(walked.x)) return 'the tile the rules see did not follow the free spot';
  if (walked.facing !== 'E') return `facing ${walked.facing} after walking east`;
  await page.waitForTimeout(300);
  const after = await spotNow(page);
  if (after.x !== walked.x) return 'the player kept walking after the key was let go';
  if (await page.isHidden('#clockStat')) return 'One stick did not show the real-time NEXT meter';

  // Step B: a tap only turns; X sneaks (slower); the round stick walks.
  await placeInRow(page);
  const before = await spotNow(page);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(40);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(500);
  const tapped = await spotNow(page);
  if (tapped.x !== before.x || tapped.y !== before.y) return 'a tap on ↓ took a step';
  if (tapped.facing !== 'S') return `a tap on ↓ turned to ${tapped.facing}, not S`;
  await page.keyboard.press('x');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  const crept = await spotNow(page);
  await page.keyboard.press('x');
  if (crept.x - tapped.x > 0.75) return `sneaking went ${(crept.x - tapped.x).toFixed(2)} tiles in 700 ms, too fast for a creep`;
  if (crept.x - tapped.x < 0.3) return 'sneaking hardly moved';
  if (!await page.isVisible('#walkStick') || await page.isVisible('#dpad')) return 'the round stick did not take the d-pad\'s place';
  await placeInRow(page);
  const pushed = await spotNow(page);
  const box = await page.locator('#walkStick').boundingBox();
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width / 2, cy, { steps: 4 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  const stuck = await spotNow(page);
  if (stuck.x - pushed.x < 0.8) return `the round stick pushed right went only ${(stuck.x - pushed.x).toFixed(2)} tiles`;

  // Step C: a stick man next to the player reaches, then strikes; one the
  // player walks away from misses.
  await placeInRow(page);
  const struck = await reachFrom(page, 1500);
  if (!struck.started) return 'a stick man beside the player never reached';
  if (!struck.hurt) return 'a reach the player stood in did not land';
  await placeInRow(page);
  await page.keyboard.down('ArrowRight');
  const dodged = await reachFrom(page, 1400);
  await page.keyboard.up('ArrowRight');
  if (!dodged.started) return 'a stick man beside the player walking away never reached';
  if (dodged.hurt) return 'a reach landed on a player who walked away';
  if (!dodged.missed) return 'a dodged reach did not say "It misses."';

  // Step D: the battery runs down by time, with no step taken, and the
  // HUD shows no turn count.
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.floor.light.on = true;
    state.floor.light.locked = false;
    state.floor.light.charge = 0.05;
  });
  await page.waitForTimeout(500);
  const light = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return { ...state.floor.light, hud: document.getElementById('lightBattery').getAttribute('aria-label') };
  });
  if (light.on || !light.locked) return 'the battery did not run out by time';
  if (!/EMPTY/i.test(light.hud)) return `the HUD's battery did not say it was empty: ${light.hud}`;
  if (await page.locator('#turnCount').evaluate(el => !el.parentElement.hidden)) return 'One stick still showed the turn count';

  // Step E: facing a stick man that reaches, SELECT (F) opens the shot's
  // dial on it, and the reach waits while the dial is up.
  await placeInRow(page);
  const reaching = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { spawnMinion } = await import('./js/combat.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    f.light = { on: true, charge: 4, locked: false };
    f.look = -Math.PI / 2;
    f.lookWant = -Math.PI / 2;
    state.run.energy = 2;
    state.run.rounds = [null, null];
    state.run.hearts = state.run.maxHearts;
    const m = spawnMinion({ row: f.playerRow, col: f.playerCol - 1 }, 'SHARD');
    m.hunts = true;
    m.stepWait = 0;
    computeVisibility();
    window.__reacher = m;
    return true;
  });
  if (!reaching) return 'could not stand a stick man beside the player';
  await page.waitForFunction(() => window.__reacher.reaching, null, { timeout: 3000 }).catch(() => {});
  await page.keyboard.press('f');
  const dial = await page.waitForSelector('#aimPanel:not([hidden])', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!dial) return 'SELECT did not open the dial on the stick man beside the player';
  const left = await page.evaluate(() => window.__reacher.reaching && window.__reacher.reaching.left);
  if (typeof left !== 'number') return 'the stick man beside the player was not reaching when the dial opened';
  await page.waitForTimeout(1000);
  const held = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    return { left: window.__reacher.reaching && window.__reacher.reaching.left, hurt: state.run.hearts < state.run.maxHearts };
  });
  if (held.hurt || held.left !== left) return 'the reach went on while the dial was up';
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.floor.minions = state.floor.minions.filter(m => m !== window.__reacher);
  });
  return '';
}

// Puts a hunting stick man on the tile west of the player (energy 1, so a
// landed reach strikes rather than starting a Struggle), waits `ms`, and
// says whether it reached, whether the player lost stability, and whether
// the room log says it missed. The stick man is taken off again.
async function reachFrom(page, ms) {
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { spawnMinion } = await import('./js/combat.js');
    state.run.energy = 1;
    state.run.hearts = state.run.maxHearts;
    window.__hearts = state.run.hearts;
    const m = spawnMinion({ row: state.floor.playerRow, col: state.floor.playerCol - 1 }, 'SHARD');
    m.hunts = true;
    m.stepWait = 0;
    window.__reacher = m;
  });
  let started = false;
  for (let t = 0; t < ms; t += 50) {
    await page.waitForTimeout(50);
    started = started || await page.evaluate(() => !!window.__reacher.reaching);
  }
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.floor.minions = state.floor.minions.filter(m => m !== window.__reacher);
    const log = document.getElementById('roomLog').textContent;
    return { started: true, hurt: state.run.hearts < window.__hearts, missed: log.includes('It misses.') };
  }).then(r => ({ ...r, started: started || r.hurt }));
}

// Stands the player on the second of five open tiles in a row, off the
// stairs (the one west of them is for a stick man to reach from). Returns
// false when there are none.
function placeInRow(page) {
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { whatBlocks } = await import('./js/passage.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const open = (r, c) => !whatBlocks(r, c) && !(f.stairs && f.stairs.row === r && f.stairs.col === c);
    for (let r = 1; r < f.GRID_SIZE - 1; r++) {
      for (let c = 2; c < f.GRID_SIZE - 4; c++) {
        if (![-1, 0, 1, 2, 3].every(d => open(r, c + d))) continue;
        f.playerRow = r;
        f.playerCol = c;
        f.playerAt = null;
        computeVisibility();
        return true;
      }
    }
    return false;
  });
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
  if (await page.isChecked('#turnsToggle')) return 'Turns was on for a new player (One stick is the default)';
  // This run drives the tutorial a turn at a time (the start screen's
  // Turns option); runTutorialStick plays its start with One stick.
  await page.check('#turnsToggle');
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

  // Face the stick man and shoot. Its kill zone would kill it outright, so
  // the dial loses its kill zone and Auto-win stops it in the maim zone:
  // a maim drops it (no guard in the tutorial; downed plan). The first
  // shot plays the dial for real first (checkTutorialDial).
  let downed = false;
  let dialChecked = false;
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
      if (aim) aim.zones = aim.zones.filter(z => z.tier !== 'kill');
      return !!aim;
    });
    if (aiming && !dialChecked) {
      dialChecked = true;
      const reason = await checkTutorialDial(page);
      if (reason) return reason;
    } else if (aiming) {
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

// The tutorial's first shot (kill or maim plan step C), with the dial at
// READY: only READY and BACK show, and the kind voice says "Breathe.";
// BACK (Escape) puts the gun down with no energy spent and no turn; F
// again opens it, F starts it: the circle shows, the marker goes round,
// and the voice gives the key; F stops it (a maim or a miss) and the
// result fades out.
async function checkTutorialDial(page) {
  const view = () => page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return {
      panel: !document.getElementById('aimPanel').hidden,
      ready: !document.getElementById('dialButtons').hidden,
      canvas: !document.getElementById('dialCanvas').hidden,
      sense: document.getElementById('senseNote').textContent,
      energy: state.run.energy,
      turn: state.run.turnCount,
      phase: state.battle.aim && state.battle.aim.phase,
    };
  });
  let v = await view();
  if (!v.panel || !v.ready || v.canvas) return 'the dial did not open at READY alone';
  if (!v.sense.includes('Breathe.')) return 'no "Breathe." at READY: ' + v.sense;
  const before = v;
  await page.keyboard.press('Escape');
  await roomIdle(page);
  v = await view();
  if (v.energy !== before.energy || v.turn !== before.turn) return 'BACK before READY spent energy or a turn';
  await page.keyboard.press('f');
  await page.waitForSelector('#aimPanel:not([hidden])', { timeout: 5000 });
  // Without its kill zone, as the caller's shots: a kill would skip "Finish it.".
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.battle.aim.zones = state.battle.aim.zones.filter(z => z.tier !== 'kill');
  });
  await page.keyboard.press('f'); // READY
  await page.waitForTimeout(100);
  v = await view();
  if (v.ready || !v.canvas || v.phase !== 'run') return 'READY did not show and start the dial';
  if (v.energy !== before.energy - 1) return 'READY did not spend the round';
  if (!v.sense.includes('Stop on K')) return 'no key line once the dial ran: ' + v.sense;
  // The marker moves every frame, but a busy machine can draw no frame for
  // a while: wait up to DIAL_MOVE_WAIT_MS for any change, not a fixed 200 ms.
  const DIAL_MOVE_WAIT_MS = 2000;
  const spin = await page.evaluate(() => document.getElementById('dialCanvas').toDataURL());
  const moved = await page.waitForFunction(first => document.getElementById('dialCanvas').toDataURL() !== first, spin, { timeout: DIAL_MOVE_WAIT_MS, polling: 100 }).then(() => true, () => false);
  if (!moved) return 'the dial\'s marker did not move';
  await page.keyboard.press('f'); // stop
  await page.waitForSelector('#aimPanel.fading', { timeout: 2000 });
  await page.waitForSelector('#aimPanel:not(.fading)', { state: 'attached', timeout: 5000 });
  await roomIdle(page);
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
  return { ok: true, detail: 'dark, light from above, barrel name, ring broken by the light, grate shudders, stick man drops out, the first shot at READY ("Breathe.", BACK spent nothing, the dial ran with its key line), one shot drops it ("Finish it."), a bump finishes it, key, door, out to the opening rest', consoleErrors, pageErrors };
}

// ---- Run 14: the tutorial with One stick ----

async function runTutorialStick(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const reason = await checkTutorialStick(page, url);
  await context.close();
  if (reason) return { ok: false, reason, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'walked freely in the dark until the light fell, to the barrel, name, ring broken by the light, the stick man reached and the kind voice said to step away', consoleErrors, pageErrors };
}

// Holds the arrow keys toward `goal` ({ row, col }) with One stick, a
// moment at a time, until `done(tutorialState)` or `ms` runs out. Returns
// the last state, or null if it never came.
async function holdToward(page, goal, done, ms = 12000) {
  const held = new Set();
  const hold = async (want) => {
    for (const k of [...held]) if (!want.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  let st = null;
  for (let t = 0; t < ms; t += 120) {
    st = await tutorialState(page);
    if (done(st)) break;
    const at = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return { row: state.floor.playerRow, col: state.floor.playerCol };
    });
    const want = [];
    if (goal.row < at.row) want.push('ArrowUp');
    if (goal.row > at.row) want.push('ArrowDown');
    if (goal.col < at.col) want.push('ArrowLeft');
    if (goal.col > at.col) want.push('ArrowRight');
    // On the goal (a bump into the barrel needs a push): keep going up.
    await hold(want.length ? want : ['ArrowUp']);
    await page.waitForTimeout(120);
    st = null;
  }
  await hold([]);
  return st && done(st) ? st : null;
}

// The tutorial's start with One stick, the default: walking (not waiting)
// brings the light from above, walking to it the barrel, the name the
// ring, the light breaks it, and the stick man's first reach brings the
// kind voice's "When it reaches, step away."
async function checkTutorialStick(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn', { timeout: 10000 });
  await page.check('#tutorialToggle');
  await page.uncheck('#turnsToggle');
  await startGameAndWaitForRoom(page);
  let st = await tutorialState(page);
  if (st.stage !== 'dark') return 'the run did not start in the tutorial room';
  st = await holdToward(page, st.spot, s => s.stage !== 'dark');
  if (!st) return 'walking in the dark never brought the light from above';
  st = await holdToward(page, st.spot, s => s.stage === 'name');
  if (!st) return 'walking to the light did not bring the barrel';
  st = await holdToward(page, st.barrel, s => s.ask, 8000);
  if (!st) return 'pushing into the barrel did not ask anything';
  await page.fill('#answerInput', 'Smoke');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  st = await tutorialState(page);
  if (st.stage !== 'ring') return 'the name did not close the ring (stage ' + st.stage + ')';
  await page.keyboard.press('v');
  await page.waitForTimeout(200);
  st = await tutorialState(page);
  if (st.stage !== 'fight') return 'the light did not break the ring (stage ' + st.stage + ')';
  for (let t = 0; t < 25000; t += 100) {
    await page.waitForTimeout(100);
    st = await tutorialState(page);
    if (st.sense.includes('step away')) return '';
  }
  return 'the stick man never reached with the kind voice saying to step away: ' + st.sense;
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
  // The page turns from the offers to the question (record book plan step
  // B), then the turn is gone and the question takes answers.
  if (!await page.evaluate(() => Boolean(document.querySelector('.page-turn')))) throw new Error('the page did not turn from the offers to the question');
  await page.waitForSelector('.page-turn', { state: 'detached', timeout: 2000 });
  // The ask screen is the record book (record book plan step A): its title
  // on the top strip, and the light tube on the left while the battery is
  // in play (this run switches it off, so the strip hides).
  const book = await page.evaluate(async () => {
    const { batteryInPlay } = await import('./js/battery.js');
    return {
      title: document.getElementById('askTitle').textContent,
      tube: document.getElementById('bookTube').offsetWidth > 0,
      inPlay: batteryInPlay(),
    };
  });
  if (book.title !== 'RELOAD.SYS' || book.tube !== book.inPlay) throw new Error('the ask screen is not the record book: ' + JSON.stringify(book));
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
  // No stick men on this floor: the run checks the answer line and ring,
  // and a strike during its waits could leave the player on their last
  // heart, so the chest's miss ended the run instead (it failed about one
  // run in fifteen that way).
  await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    state.settings.minigame = 'off';
    state.floor.minions = [];
    state.floor.crawling = [];
  });
  await page.waitForTimeout(200);

  const right = await missReload(page);
  if (right === null) return { skipped: 'no energy cell to bump' };
  // The book holds the answer (record book plan step C): the pick struck,
  // the right answer written beside it with Reveal on (not with it off),
  // until a tap on the page closes it.
  await page.waitForTimeout(150);
  const marks = await page.evaluate(() => ({
    held: !document.getElementById('askScreen').hidden,
    struck: Boolean(document.querySelector('#askQuestionPanel .mc-option.opt-struck')),
    written: document.querySelector('#askQuestionPanel .opt-struck .opt-written')?.textContent || null,
    typed: getComputedStyle(document.getElementById('answerForm')).display !== 'none',
  }));
  if (!marks.typed) {
    if (!marks.held) return 'the book closed by itself after a wrong answer';
    if (!marks.struck) return 'the wrong pick was not struck through';
    if (reveal && marks.written !== '→ ' + right) return `the book wrote "${marks.written}", the answer is "${right}"`;
    if (!reveal && marks.written) return 'the book wrote the answer with Reveal off';
    await page.click('#bookPage');
  }
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
    const sides = [[1, 0, 'N', 0, 'Numpad8'], [-1, 0, 'S', Math.PI, 'Numpad2'], [0, -1, 'E', Math.PI / 2, 'Numpad6'], [0, 1, 'W', -Math.PI / 2, 'Numpad4']];
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
  try {
    await page.waitForSelector('#battleScreen.show', { timeout: 5000 });
  } catch (err) {
    return 'bumping the chest did not open the fight: ' + await page.evaluate(async () => {
      const { state } = await import('./js/state.js');
      const { mapPanelShown } = await import('./js/gunpanels.js');
      const f = state.floor;
      const shown = [...document.querySelectorAll('section.show, .screen.show, [id$=Screen].show')].map(e => e.id);
      return JSON.stringify({ player: [f.playerRow, f.playerCol, f.facing], chest: f.chest && [f.chest.row, f.chest.col], panel: mapPanelShown(), locked: state.run.turnLocked, ended: state.run.runEnded, hearts: state.run.hearts, grabbed: f.minions.some(m => m.grabbing), screens: shown, log: [...document.querySelectorAll('#roomFeedback > *')].slice(-3).map(e => e.dataset.text) });
    });
  }
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
  try {
    await page.click('#continueBtn', { timeout: 5000 });
  } catch (err) {
    return 'no Continue after missing the chest: ' + await page.evaluate(async () => {
      const { state } = await import('./js/state.js');
      const b = state.battle;
      const shown = id => { const el = document.getElementById(id); return el ? !el.hidden && !!el.offsetParent : null; };
      const options = [...document.querySelectorAll('#battleScreen .mc-option')].map(o => (o.offsetParent ? '' : 'hidden:') + (o.disabled ? 'disabled:' : '') + o.textContent.trim().slice(0, 20));
      return JSON.stringify({ phase: b.battlePhase, modifier: b.modifier || b.activeModifier, minigame: b.minigame, wager: shown('wagerRow'), input: shown('answerInput'), options, type: b.currentQuestion && b.currentQuestion.answerType });
    });
  }
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

// ---- Run 11: room view ----

// The checks listed in the header. Returns what failed ('' when all held).
async function checkRoomView(page, url) {
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await roomIdle(page);
  await page.click('#devToggleBtn');
  await page.click('#devSkipBtn');
  await page.click('#devToggleBtn');
  await roomIdle(page);
  const map = await page.$('#mapCanvas');
  await map.screenshot({ path: path.join(os.tmpdir(), 'noesis-room-start.png') });
  // Step F: Space held fades the room into the sky with the eye, for no
  // turn; let go, the room comes back.
  const turnsBeforeLook = await turnsShown(page);
  const share = () => page.evaluate(async () => (await import('./js/roomview.js')).roomLookUp());
  await page.keyboard.down(' ');
  await page.waitForTimeout(700);
  const upShare = await share();
  await map.screenshot({ path: path.join(os.tmpdir(), 'noesis-room-look-up.png') });
  await page.keyboard.up(' ');
  await page.waitForTimeout(700);
  if (!(upShare > 0.9)) return `holding Space did not show the sky (share ${upShare})`;
  if (await share() !== 0) return `letting go of Space left the sky showing (share ${await share()})`;
  if (await turnsShown(page) !== turnsBeforeLook) return 'looking up spent a turn in the room view';
  // Step C, first (the light's battery would run down on the walk):
  // stood two tiles from a stick man and aimed at it, DEV -> Test shot
  // with Auto-win kills it in this view.
  await page.click('#devToggleBtn');
  const shot = await standAndShoot(page, map, { skip: false, view: 'room' });
  await page.click('#devToggleBtn');
  if (shot) return shot;
  await roomIdle(page);
  // Stand on an open 2 x 2 block of floor (furniture, step E, leaves
  // fewer), far from any stick man: up, right, down and left then walk
  // round it, each from where the last one ended.
  const placed = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { whatBlocks } = await import('./js/passage.js');
    const { computeVisibility } = await import('./js/sight.js');
    const { requestMapDraw } = await import('./js/mapview.js');
    const f = state.floor;
    const open = (r, c) => !whatBlocks(r, c) && !f.minions.some(m => Math.max(Math.abs(m.row - r), Math.abs(m.col - c)) <= 6);
    for (let r = 1; r < f.GRID_SIZE - 1; r++) {
      for (let c = 1; c < f.GRID_SIZE - 1; c++) {
        if (![[0, 0], [-1, 0], [-1, 1], [0, 1]].every(([dr, dc]) => open(r + dr, c + dc))) continue;
        f.playerRow = r;
        f.playerCol = c;
        computeVisibility();
        requestMapDraw();
        return true;
      }
    }
    return false;
  });
  if (!placed) return 'no open 2 x 2 block of floor on the first depth, away from the stick men';
  await page.waitForTimeout(300);
  const player = () => page.evaluate(async () => {
    const f = (await import('./js/state.js')).state.floor;
    return { row: f.playerRow, col: f.playerCol };
  });
  // Each arrow, pressed until one steps: the step must be the way it points.
  const arrows = { ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowDown: [1, 0], ArrowLeft: [0, -1] };
  const stepped = [];
  for (const [arrow, [dr, dc]] of Object.entries(arrows)) {
    const before = await player();
    await page.keyboard.press(arrow);
    await roomIdle(page);
    await page.waitForTimeout(250);
    const after = await player();
    if (after.row === before.row && after.col === before.col) continue;
    if (after.row - before.row !== dr || after.col - before.col !== dc) {
      return `${arrow} stepped (${after.row - before.row}, ${after.col - before.col}), not the way it points (${dr}, ${dc})`;
    }
    stepped.push(arrow);
  }
  if (stepped.length < 4) return `only ${stepped.length} arrow keys stepped (${stepped.join(', ')})`;
  await page.waitForTimeout(400);
  await map.screenshot({ path: path.join(os.tmpdir(), 'noesis-room-walked.png') });
  const lit = await page.evaluate(() => {
    const c = document.getElementById('mapCanvas');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4 * 97) if (data[i] + data[i + 1] + data[i + 2] > 120) bright++;
    return bright;
  });
  if (!lit) return 'the room view drew nothing bright on the map';
  return '';
}

async function runRoomView(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkRoomView(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'looked up at the sky, shot a stick man, arrows walked the way they point on screen and the room drew', consoleErrors, pageErrors };
}

// A shot in the map view, with the DEV panel open: skips to the
// first depth, stands the player two tiles from a stick man it can shoot,
// looking at it, and fires DEV -> Test shot with Auto-win on (it stops the
// dial in the kill zone). Returns what failed ('' when it was killed).
async function standAndShoot(page, map, { skip = true, view = 'room' } = {}) {
  if (skip) {
    await page.click('#devSkipBtn');
    await page.waitForTimeout(300);
  }
  const placed = await page.evaluate(async () => {
    const { state, key } = await import('./js/state.js');
    const { computeVisibility, canShoot } = await import('./js/sight.js');
    const { refreshGunTarget } = await import('./js/gun.js');
    const { requestMapDraw } = await import('./js/mapview.js');
    const f = state.floor;
    const free = (r, c) => !f.wallSet.has(key(r, c)) && !f.pillarSet.has(key(r, c)) && !f.minions.some(m => m.row === r && m.col === c) && !f.props.some(p => p.row === r && p.col === c);
    const looks = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
    for (const m of f.minions) {
      for (const [dr, dc, face] of [[2, 0, 'N'], [-2, 0, 'S'], [0, 2, 'W'], [0, -2, 'E']]) {
        const r = m.row + dr, c = m.col + dc;
        if (!free(r, c) || !free(m.row + dr / 2, m.col + dc / 2)) continue;
        f.playerRow = r; f.playerCol = c; f.facing = face; f.look = looks[face];
        computeVisibility();
        refreshGunTarget();
        if (canShoot(m) && f.gunTarget === m) {
          requestMapDraw();
          return f.minions.length;
        }
      }
    }
    return 0;
  });
  if (!placed) return 'no stick man on the first depth could be stood beside and shot';
  await page.waitForTimeout(400);
  await map.screenshot({ path: path.join(os.tmpdir(), `noesis-${view}-aim.png`) });
  await page.click('#devAutoWinBtn');
  await page.click('#devShotBtn');
  await page.waitForTimeout(150);
  await map.screenshot({ path: path.join(os.tmpdir(), `noesis-${view}-shot.png`) });
  let left = placed;
  for (let i = 0; i < 40 && left >= placed; i++) {
    await page.waitForTimeout(150);
    left = await page.evaluate(async () => (await import('./js/state.js')).state.floor.minions.length);
  }
  await page.click('#devAutoWinBtn');
  if (left >= placed) return `Test shot with Auto-win did not kill the stick man in the ${view} view`;
  return '';
}

// ---- Run 12: the charger ----

// The charger (charger plan, charger.js / chargerview.js) on a phone-sized
// screen: skips to the first depth, empties energy, clears the stick men,
// and bumps the charger in the start room. CHARGE.SYS opens over the map
// and fits it, every second wire turn is a turn, Escape closes it and a
// bump opens it on the same wires, solving it fills energy and closes it,
// and a bump at full opens nothing. Then a stick man beside the player
// reaches them while it's open: it closes, "It found you.".
async function runCharger(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkCharger(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'CHARGE.SYS opened over the map on a phone, 2 wire turns = 1 turn, wires kept on leaving, solved to full energy, full = no open, a stick man closed it', consoleErrors, pageErrors };
}

// The arrow key bumpCharger last walked into the charger with.
let lastBump = 'ArrowUp';

// Stands the player on a free side of the charger, energy as given, no
// stick men, and walks into it (the map saved to `shot` first, if given). Returns false if there is no charger or no
// free tile beside it.
async function bumpCharger(page, energy, shot = null) {
  const stood = await page.evaluate(async (energy) => {
    const { state, key } = await import('./js/state.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const charger = f.props.find(p => p.kind === 'charger');
    if (!charger) return false;
    // A free side of it, and the key that walks into it from there.
    const free = (r, c) => !f.wallSet.has(key(r, c)) && !f.pillarSet.has(key(r, c)) && !f.props.some(p => p.row === r && p.col === c);
    const side = [[1, 0, 'N', 0, 'ArrowUp'], [0, -1, 'E', Math.PI / 2, 'ArrowRight'], [0, 1, 'W', -Math.PI / 2, 'ArrowLeft'], [-1, 0, 'S', Math.PI, 'ArrowDown']]
      .find(([dr, dc]) => free(charger.row + dr, charger.col + dc));
    if (!side) return false;
    const [dr, dc, facing, look, press] = side;
    const r = charger.row + dr, c = charger.col + dc;
    f.minions = [];
    f.crawling = [];
    f.hunter = null;
    state.run.energy = energy;
    state.run.rounds = Array(energy).fill(null);
    f.playerRow = r; f.playerCol = c; f.facing = facing; f.look = look;
    computeVisibility();
    return press;
  }, energy);
  if (!stood) return false;
  await page.waitForTimeout(250);
  if (shot) await page.locator('#mapWrap').screenshot({ path: shot });
  await page.keyboard.press(stood);
  lastBump = stood;
  await page.waitForTimeout(250);
  return true;
}

async function checkCharger(page, url) {
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  await page.waitForTimeout(300);
  await page.click('#devToggleBtn');
  await page.waitForTimeout(200);
  const panel = page.locator('#chargerPanel');
  const run = (fn) => page.evaluate(fn);
  const turns = () => run(async () => (await import('./js/state.js')).state.run.turnCount);

  if (!await bumpCharger(page, 0, path.join(os.tmpdir(), 'noesis-charger-room.png'))) return 'no charger in the start room with a free tile beside it';
  if (!await panel.isVisible()) return 'bumping the charger at 0 energy did not open CHARGE.SYS';
  const box = await panel.boundingBox();
  const wrap = await page.locator('#mapWrap').boundingBox();
  if (!box || !wrap || box.x < wrap.x - 1 || box.x + box.width > wrap.x + wrap.width + 1) return 'CHARGE.SYS does not fit the map on a phone';
  const wire = await page.locator('.charger-wire').first().boundingBox();
  if (!wire || wire.width < 43) return `a wire is ${wire && wire.width} px wide on a phone (want 44)`;
  await page.screenshot({ path: path.join(os.tmpdir(), 'noesis-charger.png') });

  const before = await turns();
  await page.locator('.charger-wire').nth(1).click();
  await page.waitForTimeout(100);
  if (await turns() !== before) return 'one wire turn spent a turn';
  await page.locator('.charger-wire').nth(1).click();
  await page.waitForTimeout(150);
  if (await turns() !== before + 1) return 'two wire turns did not spend one turn';
  // The charger was made out before that turn: the kind voice says so once.
  const told = await run(async () => (await import('./js/state.js')).state.run.chargerTold);
  const whisper = await page.locator('#senseNote').innerText().catch(() => '');
  if (!told || !/holds a charge/i.test(whisper)) return `no "It still holds a charge." after the first turn by the charger (said: ${whisper})`;

  const left = await run(async () => (await import('./js/state.js')).state.floor.props.find(p => p.kind === 'charger').puzzle.wires.join());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if (await panel.isVisible()) return 'Escape did not close CHARGE.SYS';
  await page.keyboard.press(lastBump);
  await page.waitForTimeout(250);
  if (!await panel.isVisible()) return 'a second bump did not open CHARGE.SYS';
  const kept = await run(async () => (await import('./js/state.js')).state.floor.props.find(p => p.kind === 'charger').puzzle.wires.join());
  if (kept !== left) return 'the wires were not kept as they were left';

  const steps = await run(async () => {
    const { state } = await import('./js/state.js');
    const { solveWires } = await import('./js/charger.js');
    return solveWires(state.floor.props.find(p => p.kind === 'charger').puzzle);
  });
  if (!steps) return 'the wires had no way through';
  for (const i of steps) {
    await page.locator(`.charger-wire[data-i="${i}"]`).click();
    await page.waitForTimeout(30);
  }
  const energy = await run(async () => (await import('./js/state.js')).state.run.energy);
  if (energy !== 4) return `solving the wires left energy at ${energy}`;
  await page.waitForTimeout(1200);
  if (await panel.isVisible()) return 'CHARGE.SYS did not close after charging';

  await page.keyboard.press(lastBump);
  await page.waitForTimeout(250);
  if (await panel.isVisible()) return 'bumping the charger at full energy opened CHARGE.SYS';
  const full = await page.locator('#roomFeedback').innerText();
  if (!/nothing to give/i.test(full)) return `no "nothing to give" line at full energy (log: ${full})`;

  await bumpCharger(page, 0);
  if (!await panel.isVisible()) return 'CHARGE.SYS did not open the third time';
  await run(async () => {
    const { state } = await import('./js/state.js');
    const { spawnMinion } = await import('./js/combat.js');
    const { key } = await import('./js/state.js');
    const f = state.floor;
    const free = (r, c) => !f.wallSet.has(key(r, c)) && !f.pillarSet.has(key(r, c)) && !f.props.some(p => p.row === r && p.col === c) &&
      !f.minions.some(m => m.row === r && m.col === c);
    // Above too: beside the charger in a corner, below and both sides can all be wall or furniture.
    const spot = [[1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 0], [-1, 1], [-1, -1]].map(([dr, dc]) => ({ row: f.playerRow + dr, col: f.playerCol + dc }))
      .find(p => free(p.row, p.col));
    // One that always hunts (as the tutorial's does), so it comes whether or not it saw the player.
    if (spot) spawnMinion(spot, 'SHARD').hunts = true;
  });
  // Up to 5 turns (2 wire turns each): a diagonal one may have to go round a corner first.
  for (let i = 0; i < 10 && await panel.isVisible(); i++) {
    await page.locator('.charger-wire').first().click();
    await page.waitForTimeout(120);
  }
  if (await panel.isVisible()) return 'a stick man beside the player did not close CHARGE.SYS';
  const found = await page.locator('#roomFeedback').innerText();
  if (!/found you/i.test(found)) return `no "It found you." line (log: ${found})`;
  return '';
}

// ---- The safe room ----

async function runSafeRoom(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkSafeRoom(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'a reach broke at the doorway, the SHARD stopped at the open frame, the kind voice said to pull the shutter, the switch dropped it, it waited, gave up and never got in, and the switch rolled it up', consoleErrors, pageErrors };
}

async function checkSafeRoom(page, url) {
  await loadPageAndSet(page, url);
  await startGameAndWaitForRoom(page);
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  await page.waitForTimeout(300);
  await page.click('#devToggleBtn');
  await page.waitForTimeout(200);
  const run = (fn, arg) => page.evaluate(fn, arg);
  const log = () => page.locator('#roomFeedback').innerText();
  const KEYS = { '-1,0': 'ArrowUp', '1,0': 'ArrowDown', '0,-1': 'ArrowLeft', '0,1': 'ArrowRight' };

  // A doorway with the hall straight out from it and room straight in:
  // the player in the hall just outside, a SHARD behind them reaching.
  const way = await run(async () => {
    const { state, key } = await import('./js/state.js');
    const { spawnMinion } = await import('./js/combat.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const sr = f.safeRoom;
    if (!sr) return null;
    const open = (r, c) => !f.wallSet.has(key(r, c)) && !f.pillarSet.has(key(r, c)) && !f.props.some(p => p.row === r && p.col === c && p.kind !== 'shutter');
    for (const d of sr.doors) {
      const [row, col] = d.split(',').map(Number);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const out = [row + dr, col + dc], back = [row + 2 * dr, col + 2 * dc], inside = [row - dr, col - dc];
        if (sr.cells.has(key(...out)) || !open(...out) || !open(...back) || !sr.cells.has(key(...inside)) || !open(...inside)) continue;
        f.minions = [];
        f.crawling = [];
        f.playerRow = out[0];
        f.playerCol = out[1];
        sr.playerIn = false;
        const m = spawnMinion({ row: back[0], col: back[1] }, 'SHARD');
        m.lastSeen = { row: out[0], col: out[1] };
        m.track = 5;
        m.reaching = { left: 5000, ms: 5000 };
        computeVisibility();
        return { dir: [-dr, -dc] + '', door: [row, col], outside: out };
      }
    }
    return null;
  });
  if (!way) return 'no doorway of the safe room with hall straight out and room straight in';
  const inKey = KEYS[way.dir];
  await page.keyboard.press(inKey);
  await page.waitForTimeout(200);
  const reach = await run(async () => (await import('./js/state.js')).state.floor.minions[0].reaching);
  if (reach) return 'stepping onto the doorway did not break the reach';
  await page.keyboard.press(inKey);
  await page.waitForTimeout(200);
  const frame = await run(async () => {
    const { state } = await import('./js/state.js');
    const m = state.floor.minions[0];
    return { at: [m.row, m.col], stopped: !!m.atDoor };
  });
  if (frame.at + '' !== way.outside + '' || !frame.stopped) return `the SHARD did not stop at the open frame (at ${frame.at}, door ${way.door})`;
  await page.locator('#mapWrap').screenshot({ path: path.join(os.tmpdir(), 'noesis-safe-room-open.png') });

  // Beside the switch, and into it.
  const toSwitch = await run(async () => {
    const { state, key } = await import('./js/state.js');
    const { computeVisibility } = await import('./js/sight.js');
    const f = state.floor;
    const sw = f.safeRoom.switchAt;
    const free = (r, c) => f.safeRoom.cells.has(key(r, c)) && !f.safeRoom.doors.includes(key(r, c)) && !f.wallSet.has(key(r, c)) &&
      !f.pillarSet.has(key(r, c)) && !f.props.some(p => p.row === r && p.col === c);
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dr, dc]) => free(sw.row + dr, sw.col + dc));
    if (!side) return null;
    f.playerRow = sw.row + side[0];
    f.playerCol = sw.col + side[1];
    computeVisibility();
    return [-side[0], -side[1]] + '';
  });
  if (!toSwitch) return 'no free tile beside the switch';
  await page.keyboard.press(KEYS[toSwitch]);
  await page.waitForTimeout(300);
  if (!await run(async () => (await import('./js/state.js')).state.floor.safeRoom.shut)) return 'bumping the switch did not drop the shutter';
  if (!/pull the shutter down/i.test(await log())) return `no "You pull the shutter down." (log: ${await log()})`;
  await page.waitForTimeout(900);
  await page.locator('#mapWrap').screenshot({ path: path.join(os.tmpdir(), 'noesis-safe-room-shut.png') });

  let waited = false, gone = false, voice = '';
  const heard = async () => { voice += ' ' + await page.locator('#senseNote').innerText().catch(() => ''); };
  await heard();
  for (let i = 0; i < 12 && !gone; i++) {
    await page.keyboard.press('.');
    await page.waitForTimeout(150);
    await heard();
    const text = await log();
    waited = waited || /waits at the shutter/i.test(text);
    gone = /gone/i.test(text);
    const inside = await run(async () => {
      const { state } = await import('./js/state.js');
      const { inSafeRoom } = await import('./js/saferoom.js');
      return state.floor.minions.some(m => inSafeRoom(m.row, m.col));
    });
    if (inside) return 'a stick man got into the shut safe room';
  }
  if (!waited) return 'no "It waits at the shutter."';
  if (!gone) return 'the SHARD never gave up ("It\'s gone.")';
  // In the room with the switch made out, the kind voice says so once a run.
  const told = await run(async () => (await import('./js/state.js')).state.run.shutterTold);
  if (!told || !/pull the shutter/i.test(voice)) return `no "Pull the shutter. They won't follow you in." in the room (said: ${voice.trim()})`;

  await page.keyboard.press(KEYS[toSwitch]);
  await page.waitForTimeout(300);
  if (await run(async () => (await import('./js/state.js')).state.floor.safeRoom.shut)) return 'a second bump on the switch did not roll the shutter up';
  if (!/rolls up/i.test(await log())) return `no "The shutter rolls up." (log: ${await log()})`;
  return '';
}

async function runRecordBook(browser, url) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const { consoleErrors, pageErrors } = collectErrors(page);
  const failure = await checkRecordBook(page, url);
  await context.close();

  if (failure) return { ok: false, reason: failure, consoleErrors, pageErrors };
  if (consoleErrors.length || pageErrors.length) {
    return { ok: false, reason: 'console/page errors were recorded', consoleErrors, pageErrors };
  }
  return { ok: true, detail: 'LOG and MAP opened the book in the map\'s place with the clock running, the tabs turned pages, the minimap drew on the page, L / M / Esc and the same tab closed it, no walking under it', consoleErrors, pageErrors };
}

// What the record book shows now: open, read from the map, its tab, the
// clock's word, the log's first line, the minimap's drawn size, the world's
// turns and where the player stands.
async function bookState(page) {
  return page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const canvas = document.getElementById('minimap');
    const on = document.querySelector('#bookTabs .on');
    return {
      open: !document.getElementById('askScreen').hidden,
      reading: document.getElementById('roomScreen').classList.contains('reading'),
      mapHidden: document.querySelector('.map-fit').offsetParent === null,
      tab: on ? on.dataset.tab : null,
      askTab: !document.querySelector('#bookTabs [data-tab="ask"]').hidden,
      clock: document.getElementById('bookClock').textContent,
      first: (document.querySelector('#bookLogLines > *') || { textContent: '' }).textContent,
      newest: (document.getElementById('roomFeedback').lastElementChild || { dataset: {} }).dataset.text || '',
      mapDrawn: canvas.offsetParent ? canvas.width * canvas.height : 0,
      turns: state.run.turnCount,
      at: JSON.stringify([state.floor.playerRow, state.floor.playerCol, state.floor.playerAt]),
    };
  });
}

async function checkRecordBook(page, url) {
  await loadPageAndSet(page, url, { turns: false });
  await startGameAndWaitForRoom(page);
  // Out of the opening rest, so stick men and the clock are about.
  await page.click('#devToggleBtn');
  await page.waitForSelector('#devPanel.show', { timeout: 5000 });
  await page.click('#devSkipBtn');
  if (await page.isVisible('#devPanel.show')) await page.click('#devToggleBtn');
  await page.waitForTimeout(600);

  await page.click('#btnLog');
  await page.waitForTimeout(100);
  let st = await bookState(page);
  if (!st.open || !st.reading || !st.mapHidden) return 'LOG did not open the book in the map\'s place: ' + JSON.stringify(st);
  if (st.tab !== 'log' || st.askTab) return 'LOG opened at ' + st.tab + ' (ASK tab shown: ' + st.askTab + ')';
  if (st.clock !== 'CLOCK RUNNING') return 'the book read from the map said ' + st.clock;
  if (!st.newest || !st.first.startsWith(st.newest)) return 'the LOG page did not start with the newest note: ' + JSON.stringify([st.first, st.newest]);
  const turns = st.turns;
  await page.waitForTimeout(3500);
  st = await bookState(page);
  if (st.turns <= turns) return 'the world took no turns with the book open from the map';
  if (!st.open && st.turns > turns) {
    // A stick man reaching the player closes it; that's allowed, but this run wants it open.
    return 'the book closed by itself (a stick man reached the player?)';
  }

  await page.click('#bookTabs [data-tab="map"]');
  await page.waitForTimeout(600);
  st = await bookState(page);
  if (st.tab !== 'map' || !st.mapDrawn) return 'the MAP tab did not show the minimap on the page: ' + JSON.stringify(st);
  await page.click('#bookTabs [data-tab="map"]');
  await page.waitForTimeout(100);
  st = await bookState(page);
  if (st.open || st.reading || st.mapHidden) return 'the same tab again did not close the book: ' + JSON.stringify(st);

  await page.keyboard.press('m');
  await page.waitForTimeout(100);
  st = await bookState(page);
  if (!st.open || st.tab !== 'map') return 'M did not open the book at MAP';
  await page.keyboard.press('l');
  await page.waitForTimeout(600);
  st = await bookState(page);
  if (st.tab !== 'log') return 'L did not turn the book to LOG';
  const at = st.at;
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  st = await bookState(page);
  if (st.at !== at) return 'the player walked with the book open';
  if (!st.open) return 'a walking key closed the book';
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  st = await bookState(page);
  if (st.open) return 'Esc did not close the book';
  return null;
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
      const RUNS = [
        ['skip-room', runSkipRoom, url], ['battle', runBattle, url], ['gun', runGun, url],
        ['real time', runRealTime, url], ['simple enemies', runSimpleEnemies, url],
        ['free look', runFreeLook, url], ['eight ways', runEightWays, url],
        ['light battery', runLightBattery, url], ['tutorial', runTutorial, url],
        ['answer line', runAnswerLine, url], ['vents', runVents, url],
        ['room view', runRoomView, url], ['charger', runCharger, url],
        ['one stick', runOneStick, url], ['tutorial stick', runTutorialStick, url],
        ['record book', runRecordBook, url], ['safe room', runSafeRoom, url],
      ];
      // SMOKE_ONLY=tutorial,answer runs only the runs whose names hold one
      // of those words, SMOKE_REPEAT=20 runs each that many times: for
      // chasing a run that fails now and then.
      const only = (process.env.SMOKE_ONLY || '').split(',').map(w => w.trim()).filter(Boolean);
      const repeat = Math.max(1, Number(process.env.SMOKE_REPEAT) || 1);
      const chosen = RUNS.filter(([name]) => !only.length || only.some(w => name.includes(w)));
      const results = [];
      for (const [name, run, address] of chosen) {
        for (let i = 0; i < repeat; i++) results.push([repeat > 1 ? `${name} #${i + 1}` : name, await guarded(run, browser, address)]);
      }

      await browser.close();

      let failed = false;
      for (const [name, result] of results) {
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
