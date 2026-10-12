// Floor recipes: what each floor of a run holds, as plain data. floor.js,
// light.js and state.js read it through floorRecipe(); dungeon.js gets
// the numbers passed in. Whatever a recipe doesn't say stays random, so
// the loop keeps its replay value. Later steps of the level-design plan
// may add more fields here.
// No DOM access here.

// One entry per floor, first floor first. Floors past the end of the list
// reuse the last entry.
//   plan          name of the fixed plan the floor is built from
//                 (plans.js FLOOR_PLANS): the same building every run, so
//                 the plan sets the grid and the rooms, and grid, rooms,
//                 loops, startRoom and bossRoom below are not used. Left
//                 out, the floor is random (dungeon.js), sized by these.
//   grid          the floor is grid x grid tiles. Later floors have more
//                 rooms, not bigger ones (each room is a drawing from
//                 rooms.js), so the grid grows to fit them.
//   rooms         how many rooms the generator tries to place: the start,
//                 the core (boss room) and the rooms the CORE_KEYS keys
//                 are hidden among, so at least CORE_KEYS + 2, and more
//                 so the player can't tell which rooms hold them
//   loops         at most this many extra hallways beyond the minimum, for
//                 more than one route (fewer when the floor has few rooms)
//   minions       the floor's fixed set of minions (no summoning)
//   minionKinds   which kind each of those minions is (config.js
//                 MINION_KINDS), in the order they are placed: the beats'
//                 minions first, along the walk, then the roamers. Left out
//                 or too short, the rest follow MINION_KIND_ORDER. Drafts
//                 for Timothy: floor 1 meets only SHARDs, floor 2 adds a
//                 STALKER, floor 3 adds a HUSK.
//   slack         [min, max] turns the player gets beyond the shortest
//                 walk from the start through every key to the boss
//                 (light.js). On a fixed plan that walk already sweeps
//                 every key spot, so the slack is only the spare time for
//                 fights, questions and wrong turns; on a random floor it
//                 is also the time for searching. It is the difficulty
//                 dial and shrinks each floor. Fixed floors plan step C
//                 (search sim, moves only, a first-timer exploring the
//                 nearest unseen floor): depth 1 forgives a first visit
//                 with room for its fights, depth 2 is fair to a
//                 first-timer, depth 3 expects the player to have learned
//                 the building. Each floor rolls a number in
//                 the range, so luck with the layout no longer decides how
//                 much time there is (light.js). The light still spreads
//                 at the same speed; the share of the floor it covers when
//                 time runs out (the loss %) follows from the slack.
//                 Drafts for Timothy to tune by play-testing.
//   lossCoverage  used only when a recipe has no slack: the run is lost
//                 when the boss light covers this share of the walkable
//                 tiles, whatever the walk (the old dial; the stats tool's
//                 --loss mode uses it).
//   startRoom     name of the rooms.js drawing the player wakes in
//   bossRoom      name of the rooms.js drawing the boss guards: the
//                 locked core, near the middle, beside the start room
//                 Either left out means a random room, as before. Every
//                 floor uses the same two for now (Timothy: one fixed
//                 drawing each; a pool can come later).
//   lore          the floor's story: text.js keys, read in this order. The
//                 next line goes to whichever paper the player reads, so
//                 the story holds its order wherever the papers lie. Lines
//                 left unread carry over to the next floor (moves.js).
//   beats         what the player meets on the way from the start out to
//                 the farthest key, in this order (beats.js BEAT_KINDS: paper, box,
//                 minion, special). Each lands beside its share of the
//                 walk. Minion beats are some of the floor's `minions`,
//                 never extra; the rest roam at random. Papers and boxes
//                 are extra furniture; everything else stays random.
//                 Drafts for Timothy: floor 1 teaches one thing at a time,
//                 floor 2 adds a second minion before the special, floor
//                 3 puts minions between everything.
export const FLOOR_RECIPES = [
  { plan: 'school', grid: 37, rooms: 6, loops: 3, minions: 2, minionKinds: ['SHARD', 'SHARD'], slack: [100, 120],
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.1.2', 'story.1.3'],
    beats: ['paper', 'box', 'minion', 'special'] },
  { plan: 'archive', grid: 41, rooms: 7, loops: 3, minions: 3, minionKinds: ['SHARD', 'STALKER', 'SHARD'], slack: [70, 90],
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.2.1', 'story.2.2'],
    beats: ['paper', 'minion', 'box', 'minion', 'special'] },
  { plan: 'observatory', grid: 45, rooms: 8, loops: 3, minions: 4, minionKinds: ['SHARD', 'STALKER', 'HUSK', 'STALKER'], slack: [40, 60],
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.3.1', 'story.3.2'],
    beats: ['paper', 'minion', 'box', 'minion', 'special', 'minion'] },
];

// Rest floors (run.js nextFloor()): one hand-drawn room each, by kind.
//   room   name of the rooms.js drawing (dungeon.js buildRestLayout)
//   lore   the rest's story lines, queued like a depth's (floor.js
//          buildRestFloor). `between` comes once after each depth but the
//          last, so it holds one list per rest, in run order. The epilogue's
//          line is always the one its paper shows: building it drops any
//          lines still unread (the player chose not to read them).
// The opening wakes the player in the same room as every depth's start.
// The split of lines across floors is a draft for Timothy.
export const REST_RECIPES = {
  opening: { room: 'wake', lore: ['story.1.1'] },
  between: { room: 'rest', lore: [['story.1.4'], ['story.2.3']] },
  epilogue: { room: 'rest', lore: ['story.3.3'] },
};

// The story lines of the rest of this kind at this depth (state.run.roomIndex:
// the between rest after depth 1 is at 1). Past the last between list, the
// rest has no lines of its own.
export function restLore(kind, roomIndex) {
  const lore = REST_RECIPES[kind].lore;
  if (kind !== 'between') return lore;
  return lore[roomIndex - 1] || [];
}

// The ways down from a between-rest (strategy plan step C): it has two
// sets of stairs, each leading to the next depth changed one way. Timothy:
// they differ in the minions and in how fast the light comes. Drafts.
//   minions     added to (or taken from) the recipe's count, at least 1
//   addKinds    kinds of the added minions, after the recipe's own
//   swapKinds   { from: to }: those kinds become another
//   slackScale  the recipe's slack times this: above 1 the light is slower
export const FLOOR_PATHS = {
  crowded: { minions: 2, addKinds: ['SHARD', 'SHARD'], slackScale: 1.25 },
  hurried: { minions: -1, slackScale: 0.75 },
  stalked: { swapKinds: { SHARD: 'STALKER' }, slackScale: 1 },
};

// The recipe for the floor at this index (0 = the first floor). Past the
// last recipe the last one repeats, so a longer run never runs out. With
// a `path` (a FLOOR_PATHS name, the stairs taken down), the recipe is
// changed that way; the table itself never changes.
export function floorRecipe(floorIndex, path = null) {
  const recipe = FLOOR_RECIPES[Math.min(floorIndex, FLOOR_RECIPES.length - 1)];
  const way = path && FLOOR_PATHS[path];
  if (!way) return recipe;
  const swap = way.swapKinds || {};
  const kinds = (recipe.minionKinds || []).map(k => swap[k] || k);
  const minions = Math.max(1, recipe.minions + (way.minions || 0));
  return {
    ...recipe,
    minions,
    minionKinds: [...kinds, ...(way.addKinds || [])].slice(0, minions),
    slack: recipe.slack && recipe.slack.map(n => Math.round(n * way.slackScale)),
  };
}

// Two different ways down, at random, for a between-rest's two stairs.
export function pickPaths() {
  const names = Object.keys(FLOOR_PATHS);
  const first = names.splice(Math.floor(Math.random() * names.length), 1)[0];
  return [first, names[Math.floor(Math.random() * names.length)]];
}
