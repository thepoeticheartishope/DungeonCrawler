// The warning timer (presence cues plan step D, `ideas/presence-cues-plan.md`
// outside the repo): a DEV tool to tune the lamps by. It notes when each
// stick man first gave himself away (seen in the player's own light, a
// lamp's or a window's, or his shadow seen on lit floor) and, when he
// reaches for the player, how long before that it was. The goal is about
// 2 s: enough to steady a shot (Timothy, 2026-10-27).
//
// main.js calls noteSigns(now) every frame while DEV -> Warning timer is on
// (state.settings.warningTimer; One stick), and warningAtReach(m, now) on a
// `reachStarted` to say it in the room log. A sign out of view for
// WARNING_TIMER.forgetMs is forgotten: the next one starts a new approach.
// No DOM access here.

import { state, key } from './state.js';
import { WARNING_TIMER } from './config.js';
import { seesEnemy } from './sight.js';
import { lampPoolLit } from './lamps.js';
import { shadowSeen } from './shadows.js';

// What gives stick man m away right now, or null: 'light' (the player's
// own), 'lamp', 'window' (any other light they see by), or 'shadow'.
export function signOf(m) {
  if (seesEnemy(m)) {
    if (state.floor.sightSet.has(key(m.row, m.col))) return 'light';
    return lampPoolLit(m.row, m.col) ? 'lamp' : 'window';
  }
  return shadowSeen(m) ? 'shadow' : null;
}

// Notes, at `now` (ms), the first sign of every stick man that gives
// himself away (m.firstSign { at, kind }), and forgets one whose signs have
// been gone WARNING_TIMER.forgetMs (m.signGone, when they went).
export function noteSigns(now) {
  state.floor.minions.forEach(m => {
    const kind = signOf(m);
    if (kind) {
      m.signGone = null;
      if (!m.firstSign) m.firstSign = { at: now, kind };
      return;
    }
    if (!m.firstSign) return;
    if (m.signGone === null || m.signGone === undefined) m.signGone = now;
    else if (now - m.signGone >= WARNING_TIMER.forgetMs) m.firstSign = null;
  });
}

// The warning stick man m gave before reaching for the player at `now`:
// { kind, ms } from his first sign this approach, or { kind: null, ms: 0 }
// with none. The approach ends with it.
export function warningAtReach(m, now) {
  const sign = m.firstSign;
  m.firstSign = null;
  m.signGone = null;
  return sign ? { kind: sign.kind, ms: now - sign.at } : { kind: null, ms: 0 };
}
