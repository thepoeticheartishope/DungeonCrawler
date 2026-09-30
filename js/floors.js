// Floor recipes: what each floor of a run holds, as plain data. floor.js,
// light.js and state.js read it through floorRecipe(); dungeon.js gets
// the numbers passed in. Whatever a recipe doesn't say stays random, so
// the loop keeps its replay value. Later steps of the level-design plan
// add more fields here (start and boss rooms, lore order, beats, slack).
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
export const FLOOR_RECIPES = [
  { grid: 33, rooms: 4, loops: 3, minions: 2, lossCoverage: 0.9 },
  { grid: 37, rooms: 5, loops: 3, minions: 3, lossCoverage: 0.8 },
  { grid: 41, rooms: 6, loops: 3, minions: 4, lossCoverage: 0.7 },
];

// The recipe for the floor at this index (0 = the first floor). Past the
// last recipe the last one repeats, so a longer run never runs out.
export function floorRecipe(floorIndex) {
  return FLOOR_RECIPES[Math.min(floorIndex, FLOOR_RECIPES.length - 1)];
}
