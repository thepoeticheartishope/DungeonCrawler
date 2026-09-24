// Static game data and tunable constants. Nothing here changes at runtime —
// mutable game state lives in state.js instead.

// ---- Sample data. Replaced at runtime if the player loads their own list. ----
// Each entry needs a "term" and its "meaning".
// "category", "difficulty" and "answerType" are optional. When present,
// category groups entries into a world-placed vocab encounter (see
// main.js loadRoom), difficulty ("easy"/"medium"/"hard") scales that
// encounter's coin reward, and answerType groups entries for multiple-
// choice distractor selection (see quiz.js buildChoices) so wrong answers
// share the same rough "shape" as the correct one (a name isn't offered
// as a wrong answer next to a date, etc).
export const TYPING_SAMPLE_DATA = [
  { term: "CPU", meaning: "Central Processing Unit", category: "Hardware", difficulty: "easy", answerType: "term" },
  { term: "RAM", meaning: "Random Access Memory", category: "Hardware", difficulty: "easy", answerType: "term" },
  { term: "SSD", meaning: "Solid State Drive", category: "Hardware", difficulty: "medium", answerType: "term" },
  { term: "DNS", meaning: "Domain Name System", category: "Networking", difficulty: "medium", answerType: "term" }
];

export const MC_SAMPLE_DATA = [
  {
    term: "RAID",
    meaning: "Redundant Array of Independent Disks",
    category: "Hardware",
    difficulty: "medium",
    options: [
      "Redundant Array of Independent Disks",
      "Random Access Interface Device",
      "Rapid Application Integration Driver",
      "Remote Authentication Dial-In Device"
    ]
  },
  {
    term: "HTTP",
    meaning: "Hypertext Transfer Protocol",
    category: "Networking",
    difficulty: "easy",
    options: [
      "Hypertext Transfer Protocol",
      "High Throughput Transmission Protocol",
      "Host Transfer Text Program",
      "Hyperlink Text Transport Process"
    ]
  },
  {
    term: "VPN",
    meaning: "Virtual Private Network",
    category: "Networking",
    difficulty: "hard",
    options: [
      "Virtual Private Network",
      "Verified Public Node",
      "Virtual Protocol Negotiation",
      "Variable Packet Node"
    ]
  },
  {
    term: "DHCP",
    meaning: "Dynamic Host Configuration Protocol",
    category: "Networking",
    difficulty: "medium",
    options: [
      "Dynamic Host Configuration Protocol",
      "Direct Hardware Control Panel",
      "Distributed Host Connection Process",
      "Dynamic Hardware Configuration Program"
    ]
  }
];

// The boss, minion, chest, rune, coin and stairs symbols are wording, not
// config: they're the term.*.symbol lines in text.js, so they can be
// renamed alongside their names (and overridden per room).

// Symbols for category-tagged vocab encounters. glyphForCategory() in
// quiz.js picks one deterministically from a category's name, so the same
// category always renders the same symbol. They must stay distinct from the
// term.*.symbol glyphs in text.js and from the player's arrows (^ v < >) --
// '^' used to be here and read as the player facing north.
// Each answerType (the subtype tagged in the JSON) belongs to one top-level
// answer "shape". buildChoices falls back to the same shape when a subtype
// has too few wrong answers, so a creature is padded with other nouns, not
// with a verse address or a number. A top level only needs subtypes once it
// has 4+ answers (1 right + 3 wrong); until then it's its own subtype.
// answerTypes missing here (e.g. from a pasted list) just skip that tier.
export const ANSWER_TYPE_GROUPS = {
  name: 'noun',
  location: 'noun',
  book: 'noun',
  creature: 'noun',
  object: 'noun',
  theology: 'noun',
  term: 'noun',
  adjective: 'adjective',
  verb: 'verb',
  number: 'number',
  verse: 'reference'
};

export const ENCOUNTER_GLYPHS = ['!', '%', '&', '*', '+', '~', '≈', '='];

// Player glyph is directional now — an arrow matching which way they're
// facing, updated on every move attempt (even a blocked one, so "turning
// to look" costs nothing) rather than a fixed '@'.
export const DIRECTION_ARROWS = { N: '^', S: 'v', E: '>', W: '<' };

// Coins awarded for correctly answering a vocab encounter, by the
// question's own difficulty tier. Falls back to "medium" if a question is
// missing or has an invalid difficulty.
export const DIFFICULTY_COIN_REWARD = { easy: 1, medium: 2, hard: 3 };

// How many query categories a boss/minion fight offers to choose from each
// turn (see quiz.js buildCategoryChoices).
export const BATTLE_CHOICE_COUNT = 3;

// Display names for terse category codes, shown on the battle screen's
// category-choice buttons. Anything not listed here is shown as-is.
// Codes are the Bible Quiz Bowl flashcards' own section letters.
export const CATEGORY_LABELS = {
  OT: 'Old Testament',
  NT: 'New Testament',
  P: 'Prophets',
  HG: 'History & Geography',
  N: 'Names',
  LNS: 'Letters, Numbers & Symbols',
  W: 'Wisdom'
};

// Grid size and chamber count both grow as the run progresses.
// Index 0 = Room 1, index 1 = Room 2, index 2 = Room 3.
export const GRID_SIZES = [19, 23, 27];
export const CHAMBER_TARGETS = [6, 8, 10];

export const MAX_HEARTS = 3;
export const ROOM_COUNT = 3;

export const BOSS_HP = 3;       // hits needed to defeat the boss
export const MINION_HP = 1;     // hits needed to defeat one minion
// Minions are placed when a room loads (no summoning) and roam freely:
// they wander at random and only chase once the player is within
// MINION_CHASE_RANGE walkable steps. Index = room, like GRID_SIZES.
export const MINIONS_PER_ROOM = [2, 3, 4];
export const MINION_CHASE_RANGE = 4;
export const MINION_MIN_START_DISTANCE = 6; // walkable steps from the player's start

// The player's own light: every tile within PLAYER_LIGHT_RADIUS steps, plus
// tiles up to PLAYER_CONE_RANGE steps inside the cone they're facing.
export const PLAYER_LIGHT_RADIUS = 1;
export const PLAYER_CONE_RANGE = 3;

// The boss gives off light that spreads through the floor, one turn at a
// time. It reaches LIGHT_LOSS_COVERAGE of the walkable tiles after
// LIGHT_TURN_FACTOR x (walkable distance from the player's start to the
// boss) turns, and the run is lost when it does. Battles don't use turns,
// so answering never costs light — only walking and waiting do.
export const LIGHT_LOSS_COVERAGE = 0.65;
export const LIGHT_TURN_FACTOR = 2.5;

// Darkness: once the boss falls, its light dies and the floor goes dark
// outside the player's own light (explored tiles are forgotten). No new
// minions ever arrive, but the ones left hunt the player from anywhere,
// a miss costs DARK_MISS_COST hearts instead of 1, and gold is multiplied
// by DARK_GOLD_MULTIPLIER — the stairs are right there, so staying is a
// choice. Question modifiers (still to be designed) are meant to ramp up
// here too.
export const DARK_MISS_COST = 2;
export const DARK_GOLD_MULTIPLIER = 2;

// The camera always renders a fixed VIEWPORT_SIZE x VIEWPORT_SIZE window of
// the room, panning to follow the player. Must stay smaller than every
// value in GRID_SIZES, or there'd be nothing to pan.
export const VIEWPORT_SIZE = 9;
