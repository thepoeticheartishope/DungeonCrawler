// Floor recipes: what each floor of a run holds, as plain data. floor.js,
// light.js and state.js read it through floorRecipe(); dungeon.js gets
// the numbers passed in. Whatever a recipe doesn't say stays random, so
// the loop keeps its replay value. Later steps of the level-design plan
// add more fields here (slack).
// No DOM access here.

// One entry per floor, first floor first. Floors past the end of the list
// reuse the last entry.
//   grid          the floor is grid x grid tiles. Later floors have more
//                 rooms, not bigger ones (each room is a drawing from
//                 rooms.js), so the grid grows to fit them.
//   rooms         how many rooms the generator tries to place
//   loops         at most this many extra hallways beyond the minimum, for
//                 more than one route (fewer when the floor has few rooms)
//   minions       the floor's fixed set of minions (no summoning)
//   lossCoverage  the run is lost when the boss light covers this share of
//                 the walkable tiles. It is the difficulty dial: a higher
//                 share means more turns. It drops each floor.
//   startRoom     name of the rooms.js drawing the player wakes in
//   bossRoom      name of the rooms.js drawing the boss guards
//                 Either left out means a random room, as before. Every
//                 floor uses the same two for now (Timothy: one fixed
//                 drawing each; a pool can come later).
//   lore          the floor's story: text.js keys, read in this order. The
//                 next line goes to whichever paper the player reads, so
//                 the story holds its order wherever the papers lie. Lines
//                 left unread carry over to the next floor (moves.js).
//   beats         what the player meets on the way from the start to the
//                 boss, in this order (beats.js BEAT_KINDS: paper, box,
//                 minion, special). Each lands beside its share of the
//                 walk. Minion beats are some of the floor's `minions`,
//                 never extra; the rest roam at random. Papers and boxes
//                 are extra furniture; everything else stays random.
//                 Drafts for Timothy: floor 1 teaches one thing at a time,
//                 floor 2 adds a second minion before the special, floor
//                 3 puts minions between everything.
export const FLOOR_RECIPES = [
  { grid: 33, rooms: 4, loops: 3, minions: 2, lossCoverage: 0.9,
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.1.1', 'story.1.2', 'story.1.3', 'story.1.4'],
    beats: ['paper', 'box', 'minion', 'special'] },
  { grid: 37, rooms: 5, loops: 3, minions: 3, lossCoverage: 0.8,
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.2.1', 'story.2.2', 'story.2.3'],
    beats: ['paper', 'minion', 'box', 'minion', 'special'] },
  { grid: 41, rooms: 6, loops: 3, minions: 4, lossCoverage: 0.7,
    startRoom: 'wake', bossRoom: 'antechamber',
    lore: ['story.3.1', 'story.3.2', 'story.3.3'],
    beats: ['paper', 'minion', 'box', 'minion', 'special', 'minion'] },
];

// The recipe for the floor at this index (0 = the first floor). Past the
// last recipe the last one repeats, so a longer run never runs out.
export function floorRecipe(floorIndex) {
  return FLOOR_RECIPES[Math.min(floorIndex, FLOOR_RECIPES.length - 1)];
}
