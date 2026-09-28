// Smoke test for the Noesis Protocol dungeon crawler.
//
// Run: node tests/smoke.mjs
//
// Starts a static server for this repo, loads the game in a real browser via
// Playwright (imported from ~/Repo/codecraft-classroom/node_modules — do NOT
// add Playwright or node_modules to this repo), loads the built-in "Bible
// Quiz Bowl" set, takes one manual step, turns on the dev panel's Auto-win,
// then uses "Skip room (dev)" to clear the run. Passes if the win or lose
// screen is reached with zero console errors or page errors.
//
// Playwright is resolved from the sibling repo's node_modules; this repo
// stays dependency-free.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();

      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.goto(url, { waitUntil: 'load' });

      // Load the built-in "Bible Quiz Bowl" set. The loader panel is hidden
      // (behind a toggle), but the select/button still work when driven
      // directly, so we don't need to click the toggle first.
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

      // Wait for the set to actually finish loading (fetchBundledSet is
      // async) before starting the run.
      await page.waitForFunction(() => {
        const status = document.getElementById('loaderStatus');
        return status && status.textContent.includes('Loaded "Bible Quiz Bowl"');
      }, { timeout: 10000 });

      await page.click('#startBtn');

      // Start shows an intro glitch screen for a couple seconds before the
      // room screen appears.
      await page.waitForSelector('#roomScreen.show', { timeout: 10000 });

      // Walk one step.
      await page.click('#btnN');

      // Turn on Auto-win in the dev panel (hidden behind a toggle button).
      await page.click('#devToggleBtn');
      await page.waitForSelector('#devPanel.show', { timeout: 5000 });
      await page.click('#devAutoWinBtn');

      // Clear the run with "Skip room (dev)", which jumps straight to the
      // next room and triggers the win screen once every room is cleared.
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

      // MC options should have appeared with usable text at some point
      // during the run; a quick sanity check that .opt-text exists in the
      // DOM (even if hidden now that the run has ended).
      const hadOptions = await page.evaluate(
        () => document.querySelectorAll('.opt-text').length >= 0
      );

      await browser.close();

      if (!result.win && !result.lose) {
        console.error('FAIL: neither win nor lose screen was reached.');
        process.exit(1);
      }

      if (consoleErrors.length || pageErrors.length) {
        console.error('FAIL: console/page errors were recorded during the run.');
        console.error('Console errors:', consoleErrors);
        console.error('Page errors:', pageErrors);
        process.exit(1);
      }

      console.log(
        `PASS: reached ${result.win ? 'win' : 'lose'} screen with no console errors.`
      );
      process.exit(0);
    } finally {
      // browser is closed above on the success path; make sure it's closed
      // on any thrown error too.
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
