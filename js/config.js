// Static game data and tunable constants. Nothing here changes at runtime —
// mutable game state lives in state.js instead.

// ---- Sample data. Replaced at runtime if the player loads their own list. ----
// Each entry needs a "term" and its "meaning".
// "category", "difficulty" and "answerType" are optional. When present,
// category (with difficulty, "easy"/"medium"/"hard") groups entries into
// a fight's query choices (see quiz.js fightGroups), and answerType groups entries for multiple-
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
    difficulty: "medium"
  },
  {
    term: "HTTP",
    meaning: "Hypertext Transfer Protocol",
    category: "Networking",
    difficulty: "easy"
  },
  {
    term: "VPN",
    meaning: "Virtual Private Network",
    category: "Networking",
    difficulty: "hard"
  },
  {
    term: "DHCP",
    meaning: "Dynamic Host Configuration Protocol",
    category: "Networking",
    difficulty: "medium"
  }
];

// The boss, minion, chest, coin and stairs symbols are wording, not
// config: they're the term.*.symbol lines in text.js, so they can be
// renamed alongside their names (and overridden per room).

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
  relation: 'noun',  // a relative: "Brother", "Son-in-law"
  group: 'noun',     // a group of people: "Pharisees", "Magi"
  role: 'noun',      // a role or trade: "Scribe", "Centurion"
  related: 'noun',   // one person named through another: "Pharaoh's daughter"
  location: 'noun',
  book: 'noun',
  creature: 'noun',
  object: 'noun',
  theology: 'noun',
  term: 'noun',
  // CompTIA (Networking pilot, 2026-10-11): what a short answer names.
  protocol: 'noun',    // "DHCP", "SSH"
  device: 'noun',      // "Switch", "ONT"
  tool: 'noun',        // "Crimper", "Toner probe"
  networkType: 'noun', // "PAN", "WAN"
  record: 'noun',      // a DNS record type: "AAAA", "MX"
  port: 'number',      // a port number: "443" (a label, not an amount: PORT_LIKE_TYPES)
  adjective: 'adjective',
  verb: 'verb',
  number: 'number',
  verse: 'reference'
};
// Number answers that name something rather than count it (a port). Their
// wrong options are still the nearest numbers, but Close Enough and
// Higher / Lower never run them: 444 is not nearly 443.
export const PORT_LIKE_TYPES = ['port'];

// The answer types a question's stem allows, read from its first words
// ("Who…?" asks for a person, "How many…?" for a number). First match wins.
// buildChoices uses it two ways: a question with no answerType (a pasted
// list) takes the first type listed, and wrong answers stay inside these
// types as long as they can fill the choices (a soft lock: if they can't,
// it tops up from outside rather than show fewer options). A tag always
// wins: when it isn't one the stem allows, the stem is ignored, and
// tools/stem_check.mjs lists the question for review. Stems with no cue
// (most "What…?", bare terms like CompTIA's "RAID 5") are left to tags.
const PERSON_TYPES = ['name', 'relation', 'group', 'role', 'related', 'creature'];
export const STEM_CUES = [
  { cue: /^(in )?(which|what) verse\b/i, types: ['verse'] },
  { cue: /^(in )?(which|what) book\b(?!, chapter)/i, types: ['book'] },
  { cue: /^how (many|old)\b/i, types: ['number'] },
  { cue: /^(who|whom|whose|(to|by|from|with|for) whom)\b/i, types: PERSON_TYPES },
  { cue: /^which (prophet|prophetess|king|queen|apostle|disciple|judge|priest|man|woman|men|women)\b/i, types: PERSON_TYPES },
  { cue: /^where\b/i, types: ['location'] }
];


// How many query categories a boss/minion fight offers to choose from each
// turn (see quiz.js buildCategoryChoices).
export const BATTLE_CHOICE_COUNT = 3;

// A fight's query choices are answer types first ("Names", "Numbers",
// "Books" ...): each answerType maps to the choice it's offered under.
// Creatures share "Things" with objects (too few to stand alone); the
// person subtypes (relation, group, role, related) are all "Names"; types
// missing here (adjective, verb, CompTIA's term) are never a choice of
// their own — they're still asked by chests and boxes, and
// still used as wrong answers. A type is only offered with at least
// TYPE_CHOICE_MIN questions; a set with fewer than BATTLE_CHOICE_COUNT
// such types falls back to category choices (below).
export const CHOICE_TYPES = {
  name: 'name',
  relation: 'name',
  group: 'name',
  role: 'name',
  related: 'name',
  location: 'location',
  book: 'book',
  verse: 'verse',
  number: 'number',
  theology: 'theology',
  object: 'object',
  creature: 'object',
  port: 'port',
  protocol: 'protocol',
  device: 'device',
  tool: 'tool',
  networkType: 'networkType',
  record: 'record'
};
// Choice types that aren't offered on the turn right after the player
// picked them (when enough other choices remain), so the biggest, most
// familiar pool can't be the safe pick every turn.
export const NO_REPEAT_CHOICE_TYPES = ['name'];

// When the answer is a number, buildChoices offers the wrong numbers nearest
// to it in size, so the right one can't be spotted as the odd size out
// (144000 next to 2, 7 and 1). It shuffles up to NUMBER_NEAR_POOL of the
// nearest (only ones about as close as the 3rd nearest) so the same
// question doesn't always show the same three.
export const NUMBER_NEAR_POOL = 6;

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

// Grid size, room count, minions and the light's loss share per floor are
// in the floor recipes (floors.js).

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

// Map textures (js/tileart.js): which texture each part of the map is drawn
// with, by name. To restyle something, point it at another texture here; a
// new kind of texture is a new painter in tileart.js's PAINTERS.
// Textures: bricks, capstone, columnSide, crate, cobbles,
// flagstones, planks, wetStone, inlay.
//   floors  one per ROOM_THEMES key; a room with no entry gets `hall`
export const TILE_ART = {
  wall: 'bricks',           // wall faces
  wallTop: 'capstone',      // the top of a wall or pillar
  pillarSide: 'columnSide', // a pillar's sides
  box: 'crate',             // a box's sides and lid
  hall: 'cobbles',          // hallways, and any room theme not in `floors`
  floors: { crypt: 'flagstones', library: 'planks', flooded: 'wetStone', shrine: 'inlay' },
};
// How bright the textures are, as phosphor strength [darkest, lightest]
// (0..1). Floors stay low so glyphs on them read first (busy floors were
// "noise, not depth"); walls are brighter, so a wall reads as solid.
export const TILE_ART_TONES = { floor: [0.07, 0.11], wall: [0.17, 0.24], cap: [0.2, 0.26] };
// How many looks each texture has; a tile picks one by its place, so the
// pattern doesn't repeat in rows.
export const TILE_ART_LOOKS = 4;
// Pillars block walking and the player's light; the boss light spreads
// past them. A room with pillars gets a mirrored set of one of these sizes.
export const PILLARS_PER_ROOM = [2, 4];
// Whether rooms get pillars at all. Off for now (Timothy, 2026-10-10): a
// random pillar in a room blocks the view and gets in the way. A proper
// rule for structures in rooms comes later. Turn on to bring them back.
export const ROOM_PILLARS = false;
// Whether a wall piece drawn inside a room (one that doesn't touch the
// room's outer wall, like a block in the middle) is kept. Off for now, for
// the same reason as ROOM_PILLARS: those pieces block sight, and when the
// map cuts them down to stubs they look like chests. Off, they are floor.
// Dividing walls that run from the outer wall stay either way.
export const ROOM_INNER_WALLS = false;
// Papers lie flat: anyone can walk over them, and stepping onto one reads
// it (lore or nothing). Boxes are solid (not to light); bump one to
// examine it (a turn passes). A box is like the chest:
// BOX_TRAP_CHANCE of them are trapped and ask a question first (right =
// gold, wrong = the usual lost heart); the rest just open, with BOX_LOOT
// (weights, not %). Boxes never restore hearts — like the chest, healing
// is kept for something else.
export const PAPER_LORE_CHANCE = 0.4;
// Papers one room may hold (Timothy: no room littered with papers), so a
// room gives at most this many lines. Beat papers count too (floor.js).
export const PAPERS_PER_ROOM = 1;
export const BOX_TRAP_CHANCE = 0.3;
export const BOX_LOOT = { junk: 50, gold: 50 };
export const BOX_GOLD = [1, 2]; // plus the floor index, before the darkness multiplier

// Anything further than this many tiles away (in any direction, diagonals
// included) shows as a '?' until the player gets closer — enemies, items
// and furniture alike. The stairs are the exception.
export const REVEAL_DISTANCE = 5;

export const MAX_HEARTS = 3;
// THE UNFOLDING (js/exchange.js) can raise max stability, never past this.
export const MAX_HEARTS_CAP = 5;

// What THE UNFOLDING (code name: exchange, on every rest floor) trades for
// myelin, in the order its screen lists them. A depth pays roughly 5-10
// myelin, so +1 max stability means saving across floors. Prices are
// Timothy's "middle" set; tune after play-tests.
//   silence       silences the oldest haunt (not offered with none)
//   heal          +1 stability (not offered at max)
//   maxStability  +1 max stability, does not heal; once per rest, up to MAX_HEARTS_CAP
//   slack         EXCHANGE_SLACK_TURNS more turns on the next depth; once per rest, not on the epilogue
//   scout         shows where a between-rest's hidden stairs lead (strategy plan step C); only while hidden
export const EXCHANGE_ITEMS = [
  { id: 'silence', price: 2 },
  { id: 'heal', price: 4 },
  { id: 'maxStability', price: 10 },
  { id: 'slack', price: 3 },
  { id: 'scout', price: 3 },
];
export const EXCHANGE_SLACK_TURNS = 20;
// Floor goals (strategy plan step A): each danger depth rolls
// GOALS_PER_FLOOR of these, shown in the HUD and paid in myelin (flat, not
// doubled in the darkness) as the player goes down the stairs. Drafts; tune after play.
//   noMiss      answer nothing wrong on the floor (questions and reloads)
//   allPapers   read every paper (only with GOAL_PAPERS_MIN or more on the floor)
//   swift       bring the boss down before the light is GOAL_SWIFT_SHARE of the way (the eye half open)
//   noHunter    go down before the hunter wakes
//   noStruggle  never caught with no energy (gun only)
export const FLOOR_GOALS = [
  { id: 'noMiss', pay: 2 },
  { id: 'allPapers', pay: 1 },
  { id: 'swift', pay: 2 },
  { id: 'noHunter', pay: 2 },
  { id: 'noStruggle', pay: 2 },
];
export const GOALS_PER_FLOOR = 2;
// Category weaknesses (strategy plan step D, gun.js): each minion kind is
// weak to one reload group, rolled per run. A round loaded from that group
// does WEAKNESS_DAMAGE_SCALE times the damage bar's damage to it.
export const WEAKNESS_DAMAGE_SCALE = 2;
// The locked core (locked core plan, step A; dungeon.js, floor.js): every
// danger depth hides CORE_KEYS keys, one each in that many rooms picked at
// random (never the start room or the core). Stepping on one takes it.
export const CORE_KEYS = 3;
// Relays (strategy plan step B, relays.js): RELAYS_PER_FLOOR [min, max] per
// danger depth, never in the boss's or the start room. A right answer holds
// the room and takes RELAY_TURNS_BACK turns off the light (LIGHT_TURNS_PER_STEP
// turns = one step of its spread), up to RELAY_TURNS_CAP a floor, fewer than
// the walk to a relay usually costs, so relays slow the light but can't stop
// it. A wrong answer gives the light RELAY_WRONG_TURNS. Drafts; tune after play.
export const RELAYS_PER_FLOOR = [1, 2];
export const RELAY_TURNS_BACK = 6;
export const RELAY_TURNS_CAP = 10;
export const RELAY_WRONG_TURNS = 4;
export const GOAL_PAPERS_MIN = 2;
export const GOAL_SWIFT_SHARE = 0.5;
// The longest name the start screen takes, so it fits on one line in a paper.
export const PLAYER_NAME_MAX_LENGTH = 20;
export const ROOM_COUNT = 3;

// The gate (locked core plan, step B; gate.js): the boss is the gate. By
// keys held (0, 1, 2, all CORE_KEYS), the right answers it asks
// (GATE_QUESTIONS) and the modifiers on each (GATE_MODIFIERS; two come as
// one of HUNTER_MODIFIER_PAIRS). With every key it falls with none. A wrong
// answer gives the light GATE_WRONG_TURNS (like a relay's) and seals the
// gate until another key is taken. Timothy's numbers, 2026-10-12.
export const GATE_QUESTIONS = [3, 2, 1, 0];
export const GATE_MODIFIERS = [2, 1, 0, 0];
export const GATE_WRONG_TURNS = 4;
// The kinds of minion (gun combat plan, step 1). Each minion is one of
// these (`minionKind`); the floor recipe can name which (floors.js
// `minionKinds`). Until the gun arrives a fight still settles in one
// answer, so only the map's later steps read these numbers:
//   hp         hits a minion of this kind takes before it falls
//   moveEvery  it moves every this many turns (1 = every turn)
//   hitWidth   width of each of its hit (1) zones on the damage bar, which
//              runs 0 to 1 (0.14 = 14% of the bar)
//   weakWidth  width of each of its weak point (2) zones on the bar
//   size       how big it is drawn, against a tile
//   limbs      limbs a weak-point shot can cut off
//   gold       gold for killing it, before the darkness multiplier
// Starting values from the reload-and-fire mockup, for Timothy to tune
// (gold is new: tougher kinds pay more).
export const MINION_KINDS = {
  SHARD: { hp: 2, moveEvery: 1, hitWidth: 0.14, weakWidth: 0.07, size: 0.85, limbs: 2, gold: 1 },
  HUSK: { hp: 5, moveEvery: 2, hitWidth: 0.18, weakWidth: 0.1, size: 1.15, limbs: 2, gold: 3 },
  STALKER: { hp: 3, moveEvery: 1, hitWidth: 0.12, weakWidth: 0.05, size: 1.0, limbs: 2, gold: 2 },
};
// The order kinds come in on a floor whose recipe names none (or too few).
export const MINION_KIND_ORDER = ['SHARD', 'STALKER', 'HUSK'];
// How many of its last tiles a minion remembers, newest last. A strike
// knocks it back along them, the way it came (the mockup's KNOCKBACK).
export const MINION_TRAIL_LENGTH = 3;
// A minion that reaches the player strikes for MINION_STRIKE_COST
// stability (DARK_MISS_COST in the darkness, like a miss) and is knocked
// back along its trail, up to MINION_TRAIL_LENGTH tiles.
export const MINION_STRIKE_COST = 1;
// A shot that does damage stuns the minion: it skips its next
// MINION_STUN_MOVES moves, so it can't walk into the player straight after
// (Timothy). A graze or a backfire doesn't stun.
export const MINION_STUN_MOVES = 1;
// Minions are placed when a room loads (no summoning; how many is in the
// floor recipe) and roam freely: they wander at random and only chase once
// the player is within MINION_CHASE_RANGE walkable steps. That is the rule
// in Comfort mode and with DEV -> Light battery off; with the battery in
// play (light battery plan step B, combat.js notice) a stick man chases
// once it has a clear line, within MINION_LIGHT_SIGHT tiles, to the player
// or a tile their light is on (with the light on), and keeps tracking them
// in the dark until MINION_TRACK_TURNS turns pass with no sight of them.
export const MINION_CHASE_RANGE = 4;
export const MINION_LIGHT_SIGHT = 7;
export const MINION_TRACK_TURNS = 5;
export const MINION_MIN_START_DISTANCE = 6; // walkable steps from the player's start

// The intro before the first floor (introview.js): the set's questions type
// out INTRO_CHARS_PER_TICK letters every INTRO_TICK_MS until INTRO_ASK_AT_MS.
// Each line has an INTRO_GLITCH_CHANCE of one glitch: a stall of
// INTRO_STALL_MS, missing letters filled in INTRO_GAP_FILL_MS later, a dim
// line, or a restart. Then the fake player's try: one more question, a
// pause of INTRO_HESITATE_MS, a wrong answer typed a letter every
// INTRO_ANSWER_CHAR_MS, REJECTED. after INTRO_VERDICT_MS, the fade
// (INTRO_FADE_MS, starting INTRO_FADE_AFTER_MS later) and the call, held
// INTRO_CALL_HOLD_MS. About 8 s in all; any key or tap skips. Under reduced
// motion INTRO_LINES_STILL lines, the try and the call show at once and
// hold INTRO_STILL_MS.
export const INTRO_ASK_AT_MS = 2600;
export const INTRO_HESITATE_MS = 600;
export const INTRO_ANSWER_CHAR_MS = 110;
export const INTRO_ANSWER_MAX_MS = 1400; // a long answer types faster so it never takes longer than this
export const INTRO_VERDICT_MS = 450;
export const INTRO_FADE_AFTER_MS = 900;
export const INTRO_FADE_MS = 1200;
export const INTRO_CALL_HOLD_MS = 1800;
export const INTRO_TICK_MS = 16;
export const INTRO_CHARS_PER_TICK = 3;
export const INTRO_GLITCH_CHANCE = 0.35;
export const INTRO_STALL_MS = 280;
export const INTRO_GAP_FILL_MS = 450;
export const INTRO_LINES_STILL = 12;
export const INTRO_STILL_MS = 3500;

// The player's own light: every tile within PLAYER_LIGHT_RADIUS steps, plus
// tiles up to PLAYER_CONE_RANGE steps inside the cone they're facing.
export const PLAYER_LIGHT_RADIUS = 1;
export const PLAYER_CONE_RANGE = 5;
// The light's battery (battery.js, light battery plan): the light goes on
// and off (V, no turn spent) and lasts LIGHT_BATTERY_MAX turns on, charging
// 1 a turn while off. Run empty, it stays off until full again. Off, only
// the PLAYER_LIGHT_RADIUS circle is lit. DEV -> Light battery switches it
// (state.settings.lightBattery); off, or in Comfort mode, the light is
// always on, as before.
export const LIGHT_BATTERY_MAX = 4;
export const LIGHT_BATTERY = true;
// Shots in the dark (light battery plan step C, gun.js fireDark): the shot
// goes along the aim, checked every DARK_SHOT_STEP tiles for the first
// thing in the way. Its damage bar is one step harder at random: it sweeps
// in DARK_SWEEP_SCALE of the time (faster), or has one more penalty zone.
export const DARK_SHOT_STEP = 0.25;
export const DARK_SWEEP_SCALE = 0.65;
// The eye (light battery plan step E, gaze.js): GAZE_MS of the player's
// light on a stick man, in total, and it steps one closer, a quick
// GAZE_STEP_MS slide (none under reduced motion). The clock polls every
// GAZE_POLL_MS and pauses wherever the real-time clock does. DEV -> Gaze
// switches it (state.settings.gaze).
export const GAZE = true;
export const GAZE_MS = 3000;
export const GAZE_STEP_MS = 160;
export const GAZE_POLL_MS = 100;

// Free look (look.js, free look plan): the light points wherever the player
// aims, up to LOOK_FREE_ARC either side of the way the body faces, at no
// cost; looking further round turns the body, which costs a turn. The cone
// stays 90° wide (45° each side of the look) and PLAYER_CONE_RANGE deep.
// LOOK_NUDGE is one press of Q / E. DEV -> Free look switches it
// (state.settings.freeLook); off, the light points where the body faces.
// On by default since the controls (free look plan step C).
export const LOOK_FREE_ARC = Math.PI / 6;
export const LOOK_NUDGE = Math.PI / 12;
export const FREE_LOOK = true;
// Eight ways (eight ways plan): the player and the stick men walk and face
// the 4 grid ways and the 4 diagonals between them. A diagonal step needs
// both tiles it passes between free of walls and pillars (passage.js
// canPassCorner). DEV -> 8 ways switches it (state.settings.eightWays);
// off is the 4-way game as it was.
export const EIGHT_WAYS = true;
// Arrow keys (dpad.js arrowChord): after a first arrow, how long to wait
// for a second before stepping, so two pressed together walk a diagonal.
// The number pad (7 8 9 / 4 6 / 1 2 3) steps at once.
export const KEY_CHORD_MS = 60;
// The cone's half-width, and the slack each tile gets (sight.js inLookCone:
// atan2(LOOK_CONE_SLACK, distance)) so an off-angle cone isn't ragged.
export const LOOK_CONE_HALF = Math.PI / 4;
export const LOOK_CONE_SLACK = 0.35;
// The look controls (free look plan step C). The d-pad's centre is a look
// stick (dpad.js initLookStick): a drag past LOOK_STICK_DRAG_PX aims, its
// knob following up to LOOK_STICK_KNOB_PX; a tap turns the body when the
// aim is past the arc. Otherwise (light battery plan step D)
// LOOK_STICK_LIGHT_TAPS taps, each within LOOK_STICK_TAP_MS of the last,
// switch the light, and a press held LOOK_STICK_HOLD_MS waits (it was two
// taps). On the
// map (mapview.js onMapPointer), a press that moves past MAP_DRAG_PX is a
// drag that aims, not a tap. A finger's tap wobbles: at 6 px, a tap on a
// phone became a small drag that re-aimed the light and never turned.
export const LOOK_STICK_DRAG_PX = 14;
export const LOOK_STICK_KNOB_PX = 18;
export const LOOK_STICK_TAP_MS = 450;
export const LOOK_STICK_HOLD_MS = 1000;
export const LOOK_STICK_LIGHT_TAPS = 3;
export const MAP_DRAG_PX = 8;
// The pointer this close to the player's own tile (in tiles) doesn't aim:
// the angle would jump about under it.
export const LOOK_POINTER_DEAD = 0.35;

// Turning (moves.js stepPlayer). With TURN_BEFORE_STEP on, a press in a new
// direction only turns the player, so they look before they walk. Off, a
// press turns and steps at once, and the warning below covers what looking
// first used to: nothing reaches the player from the dark unannounced.
// DEV -> Turn switches it in play (state.settings.turnBeforeStep).
export const TURN_BEFORE_STEP = false;
// The warning (combat.js senseUnseen, "I see you."): a minion or the hunter
// the player can't see, SENSE_STEPS walkable steps away and due to move next
// turn, so its next move puts it right beside them. Once per approach.
export const SENSE_STEPS = 2;
// How long "I see you." stays on the map before it fades (render.js showSensed).
export const SENSE_NOTE_MS = 2600;

// Shooting (gun combat plan, step 2; sight.js canShoot): a minion can be
// shot when it is in the player's own light with a clear line to it. A shot
// that can be taken always lands (Timothy, 2026-10-11: the old hit chance by
// distance felt unfair beside the damage bar, which is the skill part).

// Energy (Timothy, 2026-10-11: was ammo; energy so later weapons and
// abilities can draw on it too). The player holds up to ENERGY_MAX and a
// run starts with ENERGY_START; it carries from floor to floor. The gun
// (gun combat plan, step 3; js/gun.js) spends 1 a shot. A reload offers
// the next category with no, one or two modifiers (from
// GUN_RELOAD_MODIFIERS; Gambler is left out, there is no gold at stake)
// and gives RELOAD_ENERGY[modifier count] energy on a right answer:
// plain 2, one modifier 3, two fill it (Timothy, 2026-10-11: was 1 / 2 / 3).
export const ENERGY_MAX = 4;
export const ENERGY_START = 1;
export const GUN_RELOAD_MODIFIERS = ['blind', 'flip', 'timer'];
export const RELOAD_ENERGY = [2, 3, ENERGY_MAX];
// A landed shot's damage bar (Timothy, 2026-10-11): the bar holds zones
// at new random spots every shot (gun.js damageZones): hit zones (1
// damage) and weak points (2 and a limb), sized by the minion kind
// (MINION_KINDS hitWidth / weakWidth), and from depth 2 penalty zones
// (DAMAGE_PENALTY_WIDTH wide; stopping on one loses 1 more energy).
// Anywhere else grazes for 0. DAMAGE_BAR_DEPTHS says how many of each per
// danger depth (the last row carries on past the table). Zones keep
// DAMAGE_ZONE_GAP from each other and from the bar's ends. Drafts for
// Timothy to tune.
export const DAMAGE_BAR_DEPTHS = [
  { hits: 2, weaks: 1, penalties: 0 },
  { hits: 2, weaks: 1, penalties: 1 },
  { hits: 1, weaks: 1, penalties: 2 },
];
export const DAMAGE_PENALTY_WIDTH = 0.08;
export const DAMAGE_ZONE_GAP = 0.04;
// Energy cells (drawn as a drum on the map; decor.js placeEnergyCells):
// each room of a floor gets one at this chance, then rooms without one are topped up
// until the floor has at least ENERGY_CELLS_MIN. Bumping one opens the
// reload panel; any answer uses it up. Only placed with the gun on.
// Drafts for Timothy to tune.
export const ENERGY_CELL_ROOM_CHANCE = 0.35;
// Struggle (Timothy's design): a minion or the hunter that reaches the
// player while they have no energy doesn't just strike. A dial sweeps
// fast, STRUGGLE_SWEEP_MS end to end (STRUGGLE_SLOW_SWEEP_MS under reduced
// motion); SELECT inside STRUGGLE_HIT_HALF of the centre pushes it back
// STRUGGLE_PUSHBACK tiles with no damage to it, anything else and it
// strikes as usual. Drafts for Timothy to tune.
// Each Struggle after the first on the same floor is harder (Timothy:
// relying on it shouldn't stay easy): the dial sweeps
// STRUGGLE_SPEEDUP_MS faster and its zone is STRUGGLE_SHRINK narrower,
// never past STRUGGLE_MIN_SWEEP_MS and STRUGGLE_MIN_HIT_HALF. A new floor
// starts again from the first.
export const STRUGGLE_SWEEP_MS = 500;
export const STRUGGLE_SLOW_SWEEP_MS = 1000;
export const STRUGGLE_HIT_HALF = 0.22;
export const STRUGGLE_PUSHBACK = 3;
export const STRUGGLE_SPEEDUP_MS = 50;
export const STRUGGLE_SHRINK = 0.03;
export const STRUGGLE_MIN_SWEEP_MS = 300;
export const STRUGGLE_MIN_HIT_HALF = 0.1;
export const ENERGY_CELLS_MIN = 3;

// The boss gives off light that spreads through the floor at a steady
// speed: one more walkable step every LIGHT_TURNS_PER_STEP turns. The run
// is lost when the floor's turns run out: the walk to the boss plus that
// floor's slack (floors.js), which is the difficulty dial and shrinks each
// floor. Battles don't use turns, so
// answering never costs light — only walking and waiting do.
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

// Haunts (js/haunts.js): a missed question comes back in a later fight
// (boss, minion or hunter) in place of a random one, HAUNT_CHANCE of the
// time, once at least HAUNT_MIN_GAP other questions have been answered
// since the miss. Right silences it; wrong keeps it waiting.
export const HAUNT_CHANCE = 0.35;
export const HAUNT_MIN_GAP = 3;

// The hunter: HUNTER_SPAWN_DELAY turns after the boss falls, something
// that can't be killed wakes on the tile farthest from the player and
// hunts them from anywhere, one step per turn — the player's own pace, so
// someone who keeps moving stays ahead, and every box opened or dead end
// lets it gain. Each of its query choices carries two modifiers at once
// (one pair per choice, from HUNTER_MODIFIER_PAIRS). Either way the answer
// throws it back to the far side of the floor; it then waits
// HUNTER_REST_TURNS after a right answer, HUNTER_REST_AFTER_MISS after a
// miss (which also costs the usual DARK_MISS_COST).
export const HUNTER_SPAWN_DELAY = 4;
export const HUNTER_REST_TURNS = 8;
export const HUNTER_REST_AFTER_MISS = 3;
// Gambler is left out: a wager on top of a two-heart miss is too harsh,
// and Blind could hide the question while the wager is being placed.
export const HUNTER_MODIFIER_PAIRS = [['blind', 'flip'], ['blind', 'timer'], ['flip', 'timer']];

// Question modifiers: each query category offered at the start of a minion
// fight may carry one, shown as a small tag beside it, so the player can
// see it and choose around it — chance per category is the floor's base,
// plus a bonus in the darkness. Boss questions always carry one (spread
// across the categories so choosing still matters). For now a modifier is
// only a mild penalty — no reward for taking it on.
export const MODIFIER_CHANCE = [0.10, 0.20, 0.30]; // index = room
export const MODIFIER_DARK_BONUS = 0.20;
// Blind Pick: the question shows for BLIND_BASE_MS plus BLIND_MS_PER_WORD
// for each of its words (capped), then it goes blank; the answers stay
// (Timothy, 2026-10-11: hiding the answers was too hard). Minigames too.
export const BLIND_BASE_MS = 2750;
export const BLIND_MS_PER_WORD = 250;
export const BLIND_MAX_MS = 8000;
// Gambler: a wager of 1 up to the floor number (never more than the gold
// held) must be placed before answering; right wins it, wrong loses it.
// Only offered once the player holds some gold.
// Flip: 1 to FLIP_MAX_ANSWERS of the answers are turned upside down or
// mirrored (one or the other per question).
export const FLIP_MAX_ANSWERS = 3;
// Timer: TIMER_SECONDS to answer, counting down beside the question;
// running out counts as a miss.
export const TIMER_SECONDS = 10;

// Minigames (minigames plan, ideas/minigames-plan.md): each time a question
// is asked there is a MINIGAME_CHANCE it runs as a minigame instead, if
// the question fits one (minigames.js rollMinigame). Never the same
// minigame twice in a row.
export const MINIGAME_CHANCE = 0.25;
// What a minigame's tier pays, beside a plain right answer (which counts
// as tier '2'): `energy` added to a reload's energy (never below 1, never
// past ENERGY_MAX), `bossDamage` HP off the boss, `goldScale` times the
// gold from a chest, box or category challenge. A relay and a minion
// fight pay any tier as a plain right answer. Tier 1 is a weak hit, X a
// perfect one.
export const MINIGAME_TIER_PAY = {
  1: { energy: -1, bossDamage: 1, goldScale: 1 },
  2: { energy: 0, bossDamage: 1, goldScale: 1 },
  X: { energy: 1, bossDamage: 2, goldScale: 2 },
};
// Close Enough: a dial from 0 to the answer times a random reach between
// CLOSE_ENOUGH_REACH_MIN and _MAX (so the answer isn't always in the
// middle), rounded up to a round number, and never shorter than
// CLOSE_ENOUGH_MIN_TOP. The dial moves in the largest power-of-ten step
// that still lands on the answer and gives at least CLOSE_ENOUGH_MIN_STEPS
// steps (but never under 1 for a whole-number answer). Bands: exact = X, within CLOSE_ENOUGH_BANDS[2] of the answer = 2,
// within CLOSE_ENOUGH_BANDS[1] = 1. Answers under CLOSE_ENOUGH_SMALL use
// CLOSE_ENOUGH_SMALL_OFF instead: that far off = 2, no tier 1.
export const CLOSE_ENOUGH_REACH_MIN = 1.25;
export const CLOSE_ENOUGH_REACH_MAX = 4;
export const CLOSE_ENOUGH_MIN_TOP = 10;
export const CLOSE_ENOUGH_MIN_STEPS = 100;
export const CLOSE_ENOUGH_BANDS = { 2: 0.10, 1: 0.25 };
export const CLOSE_ENOUGH_SMALL = 10;
export const CLOSE_ENOUGH_SMALL_OFF = 1;
// Close Enough's tick marks along the dial.
export const CLOSE_ENOUGH_TICKS = 10;
// Higher / Lower: a bar from 0 to the answer times a random reach between
// HIGHER_LOWER_REACH_MIN and _MAX, rounded up to a round number, never
// shorter than HIGHER_LOWER_MIN_TOP. It moves in the largest round step
// (1, 2, 5, 10 ...) that lands on the answer and leaves at least
// HIGHER_LOWER_MIN_STEPS steps. Answers more than HIGHER_LOWER_MAX_AT of
// their roundest step (1453, 912) don't run it. A hit on guess n pays
// HIGHER_LOWER_TIERS[n - 1]; one guess per tier.
export const HIGHER_LOWER_REACH_MIN = 1.25;
export const HIGHER_LOWER_REACH_MAX = 2.5;
export const HIGHER_LOWER_MIN_TOP = 10;
export const HIGHER_LOWER_MIN_STEPS = 10;
export const HIGHER_LOWER_MAX_AT = 40;
export const HIGHER_LOWER_TIERS = ['X', '2', '1'];
// Slow Spell: the answer's letters fill in, in a random order, one every
// SLOW_SPELL_STEP_MS (a slow clock, not world turns), until one blank is
// left; I KNOW IT stops them and the answer is typed (Timothy,
// 2026-10-11: it was four options, which gave it away). It runs one-word
// answers of SLOW_SPELL_MIN_LETTERS to _MAX_LETTERS letters. Tier:
// at most SLOW_SPELL_X_SHOWN letters shown = X, at most half = 2, more = 1.
export const SLOW_SPELL_STEP_MS = 2000;
export const SLOW_SPELL_MIN_LETTERS = 4;
export const SLOW_SPELL_MAX_LETTERS = 12;
export const SLOW_SPELL_X_SHOWN = 1;
// Slow Spell's Flip: the share of letters drawn upside down or mirrored.
export const SLOW_SPELL_FLIP_SHARE = 0.5;
// Syllable Split: a one-word name of at least SYLLABLE_SPLIT_MIN_PIECES
// pieces (minigames.js splits it on its vowels, or a question's own
// `syllables` field, "Ne-bu-chad-nez-zar"), picked in order from a tray
// that also holds SYLLABLE_SPLIT_DECOYS pieces of other names in the set.
// Wrong picks so far pay SYLLABLE_SPLIT_TIERS[wrong] (none = 2, one = 1);
// past the last one it is a miss.
export const SYLLABLE_SPLIT_MIN_PIECES = 3;
export const SYLLABLE_SPLIT_DECOYS = 4;
export const SYLLABLE_SPLIT_TIERS = ['2', '1'];
// Syllable Split's Flip: the share of tray pieces drawn upside down or
// mirrored.
export const SYLLABLE_SPLIT_FLIP_SHARE = 0.4;
// Letter Pool: runs a whole category pick (a reload, or a fight's category
// choice), not one question. Its tray is the letters of LETTER_POOL_FORM
// + 1 hidden answers of the category, each letter once and usable again.
// Any one-word answer of the category of LETTER_POOL_MIN_LETTERS to
// _MAX_LETTERS letters spelled from the tray counts. Tier: every hidden
// one found = X (it ends there), LETTER_POOL_FORM formed = 2,
// LETTER_POOL_WEAK = 1, fewer = a miss.
export const LETTER_POOL_FORM = 3;
export const LETTER_POOL_WEAK = 2;
export const LETTER_POOL_MIN_LETTERS = 3;
export const LETTER_POOL_MAX_LETTERS = 8;
// Letter Pool's Timer is longer than a question's: a hunt takes a while.
// Time up scores what was formed; it isn't a miss.
export const LETTER_POOL_TIMER_SECONDS = 45;
// Letter Pool's Flip: the share of tiles drawn upside down or mirrored.
export const LETTER_POOL_FLIP_SHARE = 0.4;
// Code Break: the answer is a locked code of its letters and digits,
// CODE_BREAK_MIN_CHARS to _MAX_CHARS long (one word; a hyphen or
// apostrophe is dropped). Not a number answer: the dials do those
// better, but a port is a code. Each guess of the code's length marks
// every character: right place, elsewhere in the code, or not in it.
// Cracked on guess n pays CODE_BREAK_TIERS[n - 1]; one guess per tier
// (Timothy, 2026-10-11: three guesses).
export const CODE_BREAK_MIN_CHARS = 2;
export const CODE_BREAK_MAX_CHARS = 9;
export const CODE_BREAK_TIERS = ['X', '2', '1'];
// Verdict: VERDICT_CLAIMS claims in a row, each a question with an answer
// filled in: the real one, or VERDICT_FALSE_SHARE of the time another
// answer of the same answerType. The question asked is one of them; the
// rest come from the set. A boss asks VERDICT_BOSS_CLAIMS, and only a
// boss (Timothy, 2026-10-11). Wrong calls pay VERDICT_TIERS[wrong] (or
// VERDICT_BOSS_TIERS), past the end a miss: with three claims 2 of 3 pays
// only 1, since calling at random gets 2 of 3 half the time. A question
// fits with VERDICT_MIN_DECOYS other answers of its type in the set.
export const VERDICT_CLAIMS = 3;
export const VERDICT_BOSS_CLAIMS = 5;
export const VERDICT_TIERS = ['X', '1'];
export const VERDICT_BOSS_TIERS = ['X', '2', '1'];
export const VERDICT_FALSE_SHARE = 0.5;
export const VERDICT_MIN_DECOYS = 3;
// Verdict's Timer is per claim, shorter than a question's: one call is
// quick.
export const VERDICT_TIMER_SECONDS = 7;
// Crosswire: the answer and another one from the set cross on a shared
// letter, like a tiny crossword: across and down, both typed. Both are
// one word of CROSSWIRE_MIN_LETTERS to _MAX_LETTERS letters, and the
// shared letter is never either word's first; it starts filled in, free
// (Timothy, 2026-10-11). REVEAL fills a square: both words right pays
// CROSSWIRE_TIERS[reveals] (the last one for more), one word right '1',
// neither a miss.
export const CROSSWIRE_MIN_LETTERS = 4;
export const CROSSWIRE_MAX_LETTERS = 8;
export const CROSSWIRE_TIERS = ['X', '2', '1'];
// Crosswire's Timer is for the whole grid; time up checks what is typed.
export const CROSSWIRE_TIMER_SECONDS = 60;
// Fog Reveal: a picture question's image under fog, FOG_REVEAL_SIDE
// tiles a side. FOG_REVEAL_CLEAR tiles lift every FOG_REVEAL_STEP_MS (a
// slow clock, held while Gambler locks it); pick from the options any
// time. Tiles still covered set the tier: at least FOG_REVEAL_X_COVERED
// = X, at least FOG_REVEAL_2_COVERED = 2, fewer = 1. No Timer (waiting
// is the game) and no Blind (the question is only "Which tool is
// shown?"; the picture is the question).
export const FOG_REVEAL_SIDE = 4;
export const FOG_REVEAL_CLEAR = 2;
export const FOG_REVEAL_STEP_MS = 2000;
export const FOG_REVEAL_X_COVERED = 12;
export const FOG_REVEAL_2_COVERED = 6;
// Sum Lock: a trapped box only. When a trapped box rolls a minigame it is
// Sum Lock if it can be (not twice in a row): its question becomes two
// number questions, whole answers of 1 to SUM_LOCK_MAX_ADDEND, and the
// lock takes only their total. Right pays SUM_LOCK_TIER (the box's gold
// doubled); wrong shows both answers and both come back as haunts. No
// modifiers: a box carries none.
export const SUM_LOCK_MAX_ADDEND = 50;
export const SUM_LOCK_TIER = 'X';

// A rest floor (dungeon.js buildRestLayout) is one room centred on a
// REST_GRID x REST_GRID grid; the rest is solid wall around the room.
export const REST_GRID = 15;
// A between-rest's two stairs (strategy plan step C) stand at least this
// many steps apart, and as far from the start.
export const REST_STAIRS_APART = 4;

// The map (js/mapview.js). Phosphor afterglow: each frame keeps
// (1 - AFTERGLOW_FADE) of the last frame's light, measured at 60 frames a
// second, so something the player leaves behind dims out over about half a
// second and a moving glyph leaves a short trail. Off under reduced motion.
export const AFTERGLOW_FADE = 0.1;
// After this long with nothing new to draw, the fade is over: the canvas
// takes the plain frame (so rounding can't leave faint ghosts) and stops.
export const AFTERGLOW_SETTLE_MS = 900;
// The map canvas draws at most this many pixels per CSS pixel. Many phones
// are 3x, which makes every frame's fills, glows and afterglow copy 2.25x
// the work of 2x for a difference the soft phosphor look doesn't show.
export const MAP_MAX_PIXEL_RATIO = 2;
// Glyph height on the map, as a share of one tile: the boss bigger than
// the player, minions and the coin smaller.
export const MAP_GLYPH_SIZES = {
  player: 0.84, boss: 1.03, minion: 0.71, hunter: 0.9, coin: 0.65,
  stairs: 0.71, chest: 0.77, prop: 0.77, exchange: 0.9, key: 0.71,
};
// The isometric map (js/isoview.js, DEV -> View). How many tile widths
// fit across the map: fewer means bigger tiles. The camera stands on the
// player, so about half this many tiles show each way along a row.
export const ISO_TILES_ACROSS = 9;
// On a map narrower than ISO_NARROW_MAP_WIDTH CSS pixels (a phone), fewer
// tiles fit across, so tiles and glyphs stay big enough to read. 7 still
// holds the player's five steps of sight (2.5 tile widths each way).
export const ISO_TILES_ACROSS_NARROW = 7;
export const ISO_NARROW_MAP_WIDTH = 400;
// The isometric map's width over its height: it takes all the height the
// HUD and the controls leave, so its shape follows the screen, from
// ISO_MAP_SHAPE_MAX (wide, a desktop) to ISO_MAP_SHAPE_MIN (tall, a phone).
// Tiles are sized by the width (ISO_TILES_ACROSS), so a taller map shows
// more rows, never smaller tiles. Keep in step with index.html's .grid-wrap
// (3 / 2 and 5 / 3 there).
export const ISO_MAP_SHAPE_MAX = 3 / 2;
export const ISO_MAP_SHAPE_MIN = 3 / 5;
// The isometric camera (DEV -> Camera). It holds still while the player
// walks inside a box round the middle of the map, ISO_CAMERA_BOX tile
// widths each way from the middle (x across, y down), and glides after
// them over ISO_CAMERA_GLIDE_MS once they step out of it. Locked to the
// player, every step shifted the whole scene along a diagonal, which
// Timothy found disorienting. The box stays small so the player's five
// steps of sight still fit on a phone's map (7 tiles across).
export const ISO_CAMERA_BOX = { x: 1, y: 0.5 };
export const ISO_CAMERA_GLIDE_MS = 220;
// How tall a wall stands, as a share of a tile's width. Pillars stand a
// little above the walls and boxes much lower (sizes in isoview.js).
export const ISO_WALL_HEIGHT = 1;
// How long each map animation takes, in ms. Looping ones stand still
// under reduced motion.
export const MAP_ANIMATION_MS = {
  slide: 300,       // a minion stepping to the next tile
  step: 140,        // the player stepping to the next tile (isometric): short, so walking stays quick. A grid N/E/S/W step; smooth walk (walkpace.js) scales the others by their length on screen
  wallCut: 160,     // a wall lowering to a stub in front of something in sight, or rising again (isometric)
  bump: 180,        // the player walking into something, out and back
  bossPulse: 2000,  // the boss's glow swelling and fading
  warp: 3600,       // the slight wrongness of the boss's and a minion's shape
  hunterWarp: 1600, // the same warp, faster: the hunter is never still
  exchangeWarp: 7000, // the same warp, slow: THE UNFOLDING never quite settles into one shape
  glitchBar: 6500,  // how often a minion's signal drops out
  coinBob: 1400,    // the coin lifting and settling
  glow: 1800,       // the stairs' and THE UNFOLDING's glow
  cellBreath: 4000, // an unused energy cell's faint glow swelling and fading (Timothy: eerie, keep it)
  mist: 14000,      // the boss mist's slow drift, there and back
  target: 1100,     // the box round the thing being fought
  playerBreath: 2600, // the stick man's chest rising and falling (isometric)
  playerIdle: 3000, // how long the player stands without moving or turning before the stick man starts looking round
  playerGlance: 5200, // once idle, one glance to the side and back in each of these
  gunShot: 260,     // the shot's flash from the gun to where it went, fading (gun plan)
  gunMiss: 900,     // MISS floating up over a minion the shot missed, fading
  darkFlash: 700,   // a stick man hit in the dark, shown in the shot's flash (light battery plan step C)
  gunRecoil: 120,   // the gun kicking back toward the player as it fires
  lookEase: 70,     // the drawn look (ring tick, cone edges, the stick man's gaze) easing toward where the player aims (free look)
  // Minions as stick men (stick enemies plan, js/stickforms.js). Slow on
  // purpose: the calm rule for motion- and flicker-sensitive players.
  stickTell: 900,    // a stick enemy eases into its tell pose, or back out (stickforms.js)
  stickTurn: 700,    // a stick enemy turns to face the player when they pass to its other side
  stickHit: 500,     // a hurt stick enemy's soft brightening and one small push
  stickDeath: 2400,  // a killed stick enemy's lines fading while six tendrils grow, go limp and fade
};
// The minimap (minimapview.js): a tile is at most MINIMAP_MAX_UNIT CSS px
// from its centre to its side point, and the plan keeps MINIMAP_PAD px
// from the map's edge.
export const MINIMAP_MAX_UNIT = 9;
export const MINIMAP_PAD = 12;
// On a fixed plan (plans.js) the minimap names the rooms the player has
// walked into, in MINIMAP_LABEL_PX text, and the building in
// MINIMAP_TITLE_PX text in its top-left corner. CSS px.
export const MINIMAP_LABEL_PX = 15;
export const MINIMAP_TITLE_PX = 22;
// The damage bar (gunpanels.js): ms for its marker to sweep from one end
// to the other (then it comes back). Under reduced motion the marker
// still has to move, since its timing is the shot, so it sweeps at half
// speed instead (the mockup's "slower sweep").
export const DAMAGE_BAR_SWEEP_MS = 1300;
export const DAMAGE_BAR_SLOW_SWEEP_MS = 2600;
// A stick enemy shows its strike tell (easing into its tell pose; with
// Simple enemies, 'e' becomes 'E') when it is this many steps from the player or nearer: one more step brings it
// next to them. Straight steps (rows + columns), like shootBlock's range.
export const FORM_TELL_STEPS = 2;
// The stick enemies' light (stickforms.js): the player's glow in a cold blue,
// a little off from theirs. halo = the glow round a line, core = the line
// itself (and step C's tendril letters), as 'r, g, b'.
export const ENEMY_LIGHT = { halo: '112, 150, 255', core: '200, 216, 255' };
// Tendrils of letters (stickforms.js, stick enemies plan step C). A hit's
// tendrils grow over TENDRIL_GROW_MS, hold for TENDRIL_HOLD_MS, then pull
// back over TENDRIL_BACK_MS, unless they stay out. Letters sit
// TENDRIL_STEP of a tile's width apart and are TENDRIL_SIZE of it tall.
export const TENDRIL_GROW_MS = 1300;
export const TENDRIL_HOLD_MS = 1700;
export const TENDRIL_BACK_MS = 1700;
export const TENDRIL_STEP = 0.09;
export const TENDRIL_SIZE = 0.15;
// Tendril letters are the set's answers with one letter wrong in each word:
// a lookalike from this table, or (for a letter in TENDRIL_MIRRORABLE, half
// the time) itself drawn backwards. Shapes, not wording, so they live here.
export const TENDRIL_LOOKALIKES = {
  E: 'F', F: 'E', O: 'Q', Q: 'O', I: 'L', L: 'I', D: 'O', B: '8', S: '5', A: '4', H: 'N', M: 'N', N: 'M',
  C: 'G', G: 'C', U: 'V', V: 'U', R: 'P', P: 'R', T: 'I', J: 'I', K: 'X', Y: 'V', W: 'V', Z: '2', X: 'K',
};
export const TENDRIL_MIRRORABLE = 'NRSJEKZLCPBDGQ';

// On-screen d-pad (js/dpad.js): holding an arrow walks like holding an
// arrow key. The first step lands on the press; after DPAD_HOLD_DELAY_MS the
// player keeps stepping every DPAD_HOLD_REPEAT_MS until the finger lifts.
// The repeat is a little slower than the iso step slide, so each step reads.
export const DPAD_HOLD_DELAY_MS = 300;
export const DPAD_HOLD_REPEAT_MS = 170;
// Smooth walk (walkpace.js): a held way steps again this long after a
// step's slide has landed (170 - 140, the beat a grid step always had).
export const WALK_REPEAT_GAP_MS = 30;
// Smooth walk is on by default; DEV -> Smooth walk switches it off.
export const SMOOTH_WALK = true;
// The room log keeps this many notes, newest at the bottom: all of them
// show when LOG opens it over the map; otherwise only the newest two sit on
// the map's bottom edge (index.html .feedback, nth-last-child(-n+2)), and
// dim ROOM_LOG_DIM_MS after the last one came.
export const ROOM_LOG_LINES = 20;
export const ROOM_LOG_DIM_MS = 6000;

// Real time (start screen option, gun plan step 8): the world (minions,
// the hunter, the boss's light) takes its turn every REALTIME_STEP_MS
// instead of after each of the player's actions. realclock.js counts
// time in polls of REALTIME_POLL_MS, and only while the clock may run.
export const REALTIME_STEP_MS = 2500;
export const REALTIME_POLL_MS = 100;
// With Real time on, the player can take a step at most this often (about
// four a second), so holding an arrow can't outrun the clock. An arrow
// pressed sooner is ignored; the gun isn't held back.
export const REALTIME_WALK_MS = 250;

// Minigame practice (Timothy, 2026-10-11; js/practice.js): PRACTICE_TAPS
// taps on the title on the start screen, each within PRACTICE_TAP_MS of
// the last, open a hidden screen to play any minigame on its own, no
// points. PRACTICE_MODIFIERS are the ones it offers; Gambler is left out
// (with no points there is nothing to wager).
export const PRACTICE_TAPS = 5;
export const PRACTICE_TAP_MS = 800;
export const PRACTICE_MODIFIERS = ['blind', 'flip', 'timer'];
// The set practice starts on when none has been played yet: Bible Quiz
// Bowl has questions for every minigame.
export const PRACTICE_DEFAULT_SET = 'builtin:bible-quiz-bowl';
