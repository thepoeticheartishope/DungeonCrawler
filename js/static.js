// Static (static and charger plan, `ideas/static-charger-notes.md` outside
// the repo; Timothy 2026-10-19, after Slender). A faint grain over the map
// grows as the closest stick man nears, seen or not, so the player feels
// something is close without being told. It replaces "I see you." while
// on (Simple enemies keep "Enemy close."). How strong it is lives here;
// staticview.js draws it. No DOM access here.

import { state } from './state.js';
import { STATIC } from './config.js';
import { bfsPath } from './combat.js';
import { shutIn } from './saferoom.js';

// How strong the static should be, 0 to 1: nothing at STATIC.startSteps
// walking steps or more from the closest stick man, full right beside the
// player (5 steps: clear while walking, rising as one gets close).
// Walking steps, so a wall between really keeps it quiet. Every
// stick man on the floor counts, downed ones too; one in a duct is in
// state.floor.crawling, not minions, so it doesn't (the grate's shudder is
// its warning). 0 with DEV -> Static off or no stick man in reach, and 0
// shut in the safe room (saferoom.js): it fades and can't rise while the
// shutter stays down.
export function staticLevel() {
  if (!state.settings.staticNoise) return 0;
  const player = { row: state.floor.playerRow, col: state.floor.playerCol };
  if (shutIn(player.row, player.col)) return 0;
  let nearest = Infinity;
  for (const m of state.floor.minions) {
    const path = bfsPath(player, { row: m.row, col: m.col }, state.floor.wallSet);
    if (path) nearest = Math.min(nearest, path.length - 1);
  }
  if (nearest >= STATIC.startSteps) return 0;
  const share = (STATIC.startSteps - nearest) / (STATIC.startSteps - 1);
  return Math.pow(Math.min(1, share), STATIC.curve);
}
