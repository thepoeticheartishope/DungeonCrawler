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
// Bible sets also carry "fact": true when the answer holds in every Bible
// translation, or false (with a "factNote" saying why) when it depends on
// one translation's wording. The game doesn't use it yet; DATA.SYS shows
// it, and tools/fact_check.py sets it (see tools/README.md).
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
// Answers are things the player selects, so none may be an explicit
// sexual term — a question can point at a difficult subject, but the
// option itself stays clean. Bundled answers are kept free of these; as a
// safety net (e.g. a pasted list), buildChoices never offers an answer
// matching this as a wrong option.
export const EXPLICIT_ANSWER_TERMS = /\b(sex|sexual|rape[sd]?|incest\w*|adulter\w*|fornicat\w*|harlot\w*|whore\w*|prostitut\w*)\b/i;

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

// A fight's query choices are answer types first ("Names", "Numbers",
// "Books" ...): each answerType maps to the choice it's offered under.
// Creatures share "Things" with objects (too few to stand alone); types
// missing here (adjective, verb, CompTIA's term) are never a choice of
// their own — they're still asked by chests, runes and encounters, and
// still used as wrong answers. A type is only offered with at least
// TYPE_CHOICE_MIN questions; a set with fewer than BATTLE_CHOICE_COUNT
// such types falls back to category choices (below).
export const CHOICE_TYPES = {
  name: 'name',
  location: 'location',
  book: 'book',
  verse: 'verse',
  number: 'number',
  theology: 'theology',
  object: 'object',
  creature: 'object'
};
// Choice types that aren't offered on the turn right after the player
// picked them (when enough other choices remain), so the biggest, most
// familiar pool can't be the safe pick every turn.
export const NO_REPEAT_CHOICE_TYPES = ['name'];

// Fallback for sets without enough answer types (CompTIA, small lists):
// a fight's query choices split a category by answer type ("OT · Names")
// only where that type has at least this many questions in the category;
// the rest stay under the plain category ("OT"), so a choice is never so
// thin it keeps repeating the same question.
export const TYPE_CHOICE_MIN = 5;
// …and a category isn't split at all when one answer type already makes up
// this share of it (it's already about one kind of answer).
export const TYPE_SPLIT_DOMINANCE = 0.8;

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

// Grid size and chamber count both grow as the run progresses: later
// floors have more rooms, not bigger ones (each room is a drawing from
// rooms.js). Index 0 = Room 1, index 1 = Room 2, index 2 = Room 3.
export const GRID_SIZES = [33, 37, 41];
export const CHAMBER_TARGETS = [4, 5, 6];

// Room themes. Every room on a floor gets one, dealt out so a floor has a
// mix (wording and lore are theme.* in text.js).
//   pillarChance  chance the room tries for pillars — kept low (tight rooms
//                 often can't fit a mirrored set, so fewer actually get them)
//   props         extra papers/boxes beyond the drawing's '?' spots [min, max]
//   boxShare      share of those that are boxes rather than papers
export const ROOM_THEMES = {
  crypt:   { pillarChance: 0.30, props: [1, 2], boxShare: 0.4 },
  library: { pillarChance: 0.15, props: [2, 4], boxShare: 0.2 },
  flooded: { pillarChance: 0.15, props: [0, 2], boxShare: 0.6 },
  shrine:  { pillarChance: 0.40, props: [0, 1], boxShare: 0.3 },
};
// Pillars block walking and the player's light; the boss light spreads
// past them. A room with pillars gets a mirrored set of one of these sizes.
export const PILLARS_PER_ROOM = [2, 4];
// Papers and boxes block walking but not light; bump one to examine it
// (a turn passes). A paper is lore or nothing. A box is like the chest:
// BOX_TRAP_CHANCE of them are trapped and ask a question first (right =
// gold, wrong = the usual lost heart); the rest just open, with BOX_LOOT
// (weights, not %). Boxes never restore hearts — like the chest, healing
// is kept for something else.
export const PAPER_LORE_CHANCE = 0.4;
export const BOX_TRAP_CHANCE = 0.3;
export const BOX_LOOT = { junk: 50, gold: 50 };
export const BOX_GOLD = [1, 2]; // plus the floor index, before the darkness multiplier

// Anything further than this many tiles away (in any direction, diagonals
// included) shows as a '?' until the player gets closer — enemies, items
// and furniture alike. The stairs are the exception.
export const REVEAL_DISTANCE = 3;

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

// The boss gives off light that spreads through the floor at a steady
// speed: one more walkable step every LIGHT_TURNS_PER_STEP turns. The run
// is lost when it covers that floor's LIGHT_LOSS_COVERAGE of the walkable
// tiles, so the percentage is the difficulty dial — a higher one means
// more turns. It drops each floor. Battles don't use turns, so answering
// never costs light — only walking and waiting do. Index = room, like
// GRID_SIZES.
export const LIGHT_LOSS_COVERAGE = [0.9, 0.8, 0.7];
export const LIGHT_TURNS_PER_STEP = 4;

// Darkness: once the boss falls, its light dies and the floor goes dark
// outside the player's own light (explored tiles are forgotten). No new
// minions ever arrive, but the ones left hunt the player from anywhere,
// a miss costs DARK_MISS_COST hearts instead of 1, and gold is multiplied
// by DARK_GOLD_MULTIPLIER — the stairs are right there, so staying is a
// choice. Question modifiers (still to be designed) are meant to ramp up
// here too.
export const DARK_MISS_COST = 2;
export const DARK_GOLD_MULTIPLIER = 2;

// Question modifiers: each query category offered at the start of a minion
// fight may carry one, shown as a small tag beside it, so the player can
// see it and choose around it — chance per category is the floor's base,
// plus a bonus in the darkness. Boss questions always carry one (spread
// across the categories so choosing still matters). For now a modifier is
// only a mild penalty — no reward for taking it on.
export const MODIFIER_CHANCE = [0.10, 0.20, 0.30]; // index = room
export const MODIFIER_DARK_BONUS = 0.20;
// Blind Pick: answers show for BLIND_BASE_MS plus BLIND_MS_PER_WORD for
// every word across all of them (capped), then their text disappears.
export const BLIND_BASE_MS = 2000;
export const BLIND_MS_PER_WORD = 250;
export const BLIND_MAX_MS = 7000;
// Gambler: a wager of 1 up to the floor number (never more than the gold
// held) must be placed before answering; right wins it, wrong loses it.
// Only offered once the player holds some gold.
// Flip: 1 to FLIP_MAX_ANSWERS of the answers are turned upside down or
// mirrored (one or the other per question).
export const FLIP_MAX_ANSWERS = 3;
// Timer: TIMER_SECONDS to answer, counting down beside the question;
// running out counts as a miss.
export const TIMER_SECONDS = 10;

// The camera always renders a fixed VIEWPORT_SIZE x VIEWPORT_SIZE window of
// the room, panning to follow the player. Must stay smaller than every
// value in GRID_SIZES, or there'd be nothing to pan.
export const VIEWPORT_SIZE = 9;
