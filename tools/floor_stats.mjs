// Floor statistics: builds many floors per depth with buildFloor() in Node
// and prints how long the walk to the boss is, how many turns the light
// gives, and the slack between them (the steps left over for exploring).
// Used to tune the floor recipes in js/floors.js. Not part of the game.
//
// Run from the repo root:
//   node tools/floor_stats.mjs [floors per depth] [--loss 0.9,0.8,0.7]
// --loss measures each listed loss share on every floor instead of the
// recipe's own slack range, one column each (the table in the
// level-design plan).

import { state, key } from '../js/state.js';
import { MC_SAMPLE_DATA } from '../js/config.js';
import { buildFloor } from '../js/floor.js';
import { FLOOR_RECIPES } from '../js/floors.js';

// The value at fraction p (0..1) of a sorted list.
function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// "p10 / p50 / p90" of a list of numbers, the spread the plan compares.
function spread(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.1, 0.5, 0.9].map(p => percentile(sorted, p)).join(' / ');
}

// Builds one floor at this depth and returns its walk to the boss, light
// turn budget, slack and loss share. The walk is the boss light's own step count to
// the start tile, so it goes around walls, pillars and boxes like the
// player does.
function measure(floorIndex) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.roomIndex = floorIndex;
  buildFloor();
  const f = state.floor;
  const walk = f.bossDist.get(key(f.PLAYER_START.row, f.PLAYER_START.col));
  return { walk, budget: f.lightTurnBudget, slack: f.lightTurnBudget - walk, loss: Math.round(f.lightLossShare * 100) };
}

// Builds `count` floors at this depth and returns the measurements. With
// `loss` set, the recipe's slack range is set aside and that loss share is
// used instead (the old dial), so the two can be compared.
function sample(floorIndex, count, loss) {
  const recipe = FLOOR_RECIPES[floorIndex];
  const saved = { slack: recipe.slack, lossCoverage: recipe.lossCoverage };
  if (loss !== undefined) {
    delete recipe.slack;
    recipe.lossCoverage = loss;
  }
  const rows = [];
  for (let i = 0; i < count; i++) rows.push(measure(floorIndex));
  Object.assign(recipe, saved);
  if (saved.slack === undefined) delete recipe.slack;
  return rows;
}

// The recipe's slack range as "min-max", or "-" when it has none.
function slackRange(recipe) {
  return recipe.slack ? recipe.slack.join('-') : '-';
}

// Reads the command line: a floor count and an optional --loss list.
function readArgs(argv) {
  const lossAt = argv.indexOf('--loss');
  const losses = lossAt >= 0 ? argv[lossAt + 1].split(',').map(Number) : null;
  const rest = argv.filter((_, i) => i !== lossAt && i !== lossAt + 1);
  return { count: Number(rest[0]) || 300, losses };
}

// Prints the recipe table: rooms, walk, light budget and slack per floor.
function printRecipeTable(count) {
  console.log(`${count} floors per depth, recipes as in js/floors.js. Slack = light turns - walk to the boss.\n`);
  console.log('| Floor | Rooms | Slack range | Walk to boss (p10 / p50 / p90) | Light turns (p50) | Slack (p10 / p50 / p90) | Loss % (p10 / p50 / p90) |');
  console.log('|---|---|---|---|---|---|---|');
  FLOOR_RECIPES.forEach((recipe, i) => {
    const rows = sample(i, count);
    const budget = [...rows.map(r => r.budget)].sort((a, b) => a - b);
    console.log(`| ${i + 1} | ${recipe.rooms} | ${slackRange(recipe)} | ${spread(rows.map(r => r.walk))} | ${percentile(budget, 0.5)} | ${spread(rows.map(r => r.slack))} | ${spread(rows.map(r => r.loss))} |`);
  });
}

// Prints slack for every floor under each listed loss share.
function printLossTable(count, losses) {
  console.log(`${count} floors per depth. Slack (p10 / p50 / p90) for each loss share.\n`);
  console.log(`| Floor | ${losses.map(l => Math.round(l * 100) + '%').join(' | ')} |`);
  console.log(`|---|${losses.map(() => '---').join('|')}|`);
  FLOOR_RECIPES.forEach((_, i) => {
    const cells = losses.map(loss => spread(sample(i, count, loss).map(r => r.slack)));
    console.log(`| ${i + 1} | ${cells.join(' | ')} |`);
  });
}

const { count, losses } = readArgs(process.argv.slice(2));
if (losses) printLossTable(count, losses);
else printRecipeTable(count);
