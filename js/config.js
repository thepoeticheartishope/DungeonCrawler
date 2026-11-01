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
  standard: 'noun',    // a named standard: "802.11ax", "802.3at", "Bluetooth", "NFC"
  config: 'noun',      // a network setting or feature: "Subnet mask", "VLAN", "Scope"
  connection: 'noun',  // an internet connection type: "DSL", "Satellite", "WISP"
  cable: 'noun',       // a cable type: "UTP", "Plenum cable", "Cat 6A", "Single-mode"
  connector: 'noun',   // a connector: "RJ45", "LC", "Molex", "USB-C"
  interface: 'noun',   // a bus or video interface: "HDMI", "SATA", "USB 3.0"
  memory: 'noun',      // a RAM type or module: "DDR5", "SODIMM", "ECC"
  storage: 'noun',     // a drive, its interface or form factor: "NVMe", "M.2", "2.5-inch"
  raid: 'noun',        // a RAID level: "RAID 5"
  board: 'noun',       // a motherboard form factor, slot or card: "ATX", "PCIe", "Capture card"
  component: 'noun',   // another PC part or feature: "TPM", "Heat sink", "Modular PSU"
  display: 'noun',     // a display type, part or attribute: "OLED", "Inverter", "Refresh rate"
  printer: 'noun',     // a printer type or part: "Laser printer", "Fuser", "ADF"
  printSetting: 'noun', // a print or scan setting or task: "Duplex", "Secured print", "Calibration"
  pdl: 'noun',         // a page description language: "PCL", "PostScript" (fights offer it under a bigger choice)
  accessory: 'noun',   // a mobile accessory or input device: "Stylus", "Docking station"
  mobileSetting: 'noun', // a mobile connection or management feature: "Hotspot", "eSIM", "MDM"
  cellular: 'noun',    // a cellular generation: "3G", "4G", "5G" (fights offer it under a bigger choice)
  virtualization: 'noun', // a virtualization idea: "Type 1 hypervisor", "Container", "VDI"
  cloud: 'noun',       // a cloud trait: "Elasticity", "Egress", "Multitenancy"
  // The likeliest cause of a symptom (220-1201 domain 5), one type per area
  // so wrong answers stay in the same area; fights offer them all as one.
  causePC: 'noun',     // "Failing CMOS battery", "Overheating"
  causeDrive: 'noun',  // "Mechanical failure", "Damaged boot sector"
  causeDisplay: 'noun', // "Wrong input source", "Failed backlight"
  causeMobile: 'noun', // "Swollen battery", "Damaged charging port"
  causeNetwork: 'noun', // "No DHCP lease", "Duplex mismatch"
  causePrinter: 'noun', // "Low toner", "Faulty fuser"
  cloudModel: 'noun',  // a cloud deployment model: "Hybrid cloud" (fights offer it under a bigger choice)
  cloudService: 'noun', // a cloud service model: "IaaS", "SaaS" (fights offer it under a bigger choice)
  cpuFeature: 'noun',  // a CPU virtualization feature: "VT-x", "SLAT" (fights offer it under a bigger choice)
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


// How many query categories a boss fight offers to choose from each
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
  record: 'record',
  standard: 'standard',
  config: 'config',
  connection: 'connection',
  cable: 'cable',
  connector: 'connector',
  interface: 'interface',
  memory: 'memory',
  storage: 'storage',
  raid: 'raid',
  board: 'board',
  component: 'component',
  display: 'display',
  printer: 'printer',
  printSetting: 'printSetting',
  accessory: 'accessory',
  mobileSetting: 'mobileSetting',
  virtualization: 'virtualization',
  cloud: 'cloud',
  // Small CompTIA types, each too few for a choice of its own, ride with
  // a bigger one (wrong answers still come from their own type).
  cloudModel: 'cloud',
  cloudService: 'cloud',
  cpuFeature: 'virtualization',
  cellular: 'mobileSetting',
  pdl: 'printSetting',
  causePC: 'cause',
  causeDrive: 'cause',
  causeDisplay: 'cause',
  causeMobile: 'cause',
  causeNetwork: 'cause',
  causePrinter: 'cause'
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
// makes the dial's kill zone MATCH_KILL_SCALE times as wide (kill or maim
// plan: there is no damage left to double).
export const MATCH_KILL_SCALE = 1.5;
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
// The charger (charger plan, `ideas/charger-plan.md` outside the repo;
// charger.js): a machine in the start room, gun on only, that fills energy
// to full through CHARGE.SYS, a wire puzzle with no wrong move. Wires are
// `sizes[depth]` square (the last for any deeper depth: Timothy 2026-10-26,
// 4 x 4 on depth 1, 5 x 5 from depth 2), and every `wireTurnsPerTurn` wire
// turns spend a turn.
// The ship's stations (ship plan step B, stations.js; Timothy 2026-10-30):
// the training console in Command (`train`) and a crew member's board
// (`teach`) run the charger's wires, `size` square, with `breakers` of
// them that close only on a right answer. Drafts; tune in play.
export const SHIP_STATIONS = {
  train: { size: 4, breakers: 1 },
  teach: { size: 5, breakers: 2 },
};
// The ship's run (ship plan step C, ship.js; Timothy 2026-10-30; numbers
// from the loop mockup, drafts to tune in play). No timers (Timothy
// 2026-10-31: no arrival clock, training period, burn window or Timer on
// questions). `burnsNeeded` full burns reach the planet. Crew panic goes up
// a step with each failure and down one after `calmStreak` right answers in
// a row while teaching. At each step: 1 Uneasy, 2 Shaken (a wire slips every
// `slipEveryMs[2]` while a burn is under way), 3 Panicking (slips every
// `slipEveryMs[3]`), `brokenAt` Broken: the run is lost.
export const SHIP_RUN = {
  burnsNeeded: 3,
  slipEveryMs: [0, 0, 12000, 6000],
  calmStreak: 3,
  brokenAt: 4,
  endDelayMs: 900,    // the room's last line shows this long before the end screen
};
// The ship's crew roles (crew roles plan, ideas/crew-roles-plan.md outside
// the repo; Timothy 2026-10-30: a role for each minigame; roles.js). Each
// role's job is `SHIP_JOB.rounds` rounds of its minigame; `passAt` right
// or more and its `benefit` helps the run once, for good:
//   burns      one burn fewer needed
//   shield     the next failure raises no panic
//   panicDown  panic down a step now
//   calm       calming takes `streak` right answers in a row
//   slips      wires slip `factor` times less often
// A role sits out a run whose set can't give its minigame
// `SHIP_JOB.minFitting` questions (minigames.js roleCanRun). The Engineer
// is the wires (stations.js), not one of these. Names, rooms and benefits
// are drafts.
export const SHIP_ROLES = [
  { id: 'navigator', minigame: 'closeEnough', benefit: { kind: 'burns' } }, // was +45s clock (timers gone 2026-10-31)
  { id: 'pilot', minigame: 'fuelMix', benefit: { kind: 'burns' } }, // was Higher / Lower (ship minigames plan step A)
  { id: 'comms', minigame: 'slowSpell', benefit: { kind: 'shield' } },
  { id: 'medic', minigame: 'syllableSplit', benefit: { kind: 'panicDown' } },
  { id: 'cook', minigame: 'letterPool', benefit: { kind: 'calm', streak: 2 } },
  { id: 'systems', minigame: 'codeBreak', benefit: { kind: 'slips', factor: 2 } },
  { id: 'science', minigame: 'verdict', benefit: { kind: 'shield' } }, // was longer burn windows
  { id: 'quartermaster', minigame: 'crosswire', benefit: { kind: 'panicDown' } }, // was +30s clock
  { id: 'sensors', minigame: 'scanner', benefit: { kind: 'panicDown' } }, // was Fog Reveal (ship minigames plan step B)
  { id: 'lifeSupport', minigame: 'sumLock', benefit: { kind: 'shield' } }, // was a missed-window shield
];
export const SHIP_JOB = { rounds: 3, passAt: 2, minFitting: 3, learnRounds: 3 }; // learnRounds: at the console, at most this many rounds to learn a role (step B)
// The tragedy intro (shipview.js): seconds between one line fading in and
// the next. Slow on purpose: text comes in slowly, never flickers.
export const SHIP_INTRO_STEP_S = 1.4;
// The opening takes command by itself after this many seconds: when its
// tune (MUSIC.shipIntro: the song's last 2:10, from 1:20 of 3:30) ends,
// so the music and the start line up. Counted whether sound is on or off.
export const SHIP_INTRO_AUTO_S = 130;
// How long one intro line takes to fade in (index.html .ship-intro-line's
// animation), so a tap after that takes command instead of showing the rest.
export const SHIP_INTRO_FADE_S = 1.6;
// How many of each part of the random tragedy text.js has (ship.js
// rollTragedy: 'tragedy.captain.1' and on).
export const TRAGEDY_PARTS = { captain: 6, cause: 5, ship: 5, planet: 5 };
// Once charged, CHARGE.SYS stays up `closeMs` with its line, then closes.
export const CHARGER = {
  sizes: [4, 5],
  wireTurnsPerTurn: 2,
  closeMs: 900,
};
// The safe room (safe room plan, `ideas/safe-room-plan.md` outside the repo;
// Timothy 2026-10-27; saferoom.js): the start room of a danger floor gets a
// shutter on each doorway and a pull switch inside. Shut, no stick man
// comes in; the hunter lifts it. A stick man at an open doorway stops `hesitateMs` before it
// comes in; one shut out gives up `waitMs` after the shutter stopped it;
// the hunter stands `hunterLiftMs` at a shut one before it rolls up. The
// shutter drops over `dropMs` (roomview.js). With Real time off a turn
// counts as `turnMs` for these waits. Drafts; tune after play.
// The volume of all the game's sound (sound.js), one step per tap of the
// top bar's SOUND button, as a share of full: off, 1/3, 2/3, full. The
// game starts on `startAt` (1/3, Timothy 2026-11-01) and remembers the
// player's pick under `storageKey`.
export const SOUND_VOLUME = {
  steps: [0, 1 / 3, 2 / 3, 1],
  startAt: 1,
  storageKey: 'noesisProtocol.soundVolume',
  changeMs: 150,
};

// The game's music (music.js), one entry per tune: the file, its own
// loudness under the game's volume (0 to 1), how long it takes to fade in
// and out (an eased curve, so it starts and ends gently), and whether it
// loops or instead starts over from the top each time it comes up. A
// looping tune whose file ends with a fade-out (an ending) gives
// `loopEndS`, where the ending starts, and `crossfadeS`: that long before
// loopEndS a second copy starts from the top and crossfades in, so the
// ending is never heard and the loop has no seam (Timothy 2026-11-01).
// The ending points were measured from each file's loudness. Both
// Jeremy Blake (Timothy checked the licences; credits go in at the end).
// - shipIntro: "Recovery Mission" ("Helios's Dreams") on the ship's
//   opening, from 1:20, "the best" part (Timothy 2026-11-01). The file is
//   cut to start there (a seek needs a server that sends files in pieces,
//   which not every one does), 2:10 long. It plays out once; the opening
//   takes command by itself when it ends (shipview.js).
// - safeRoom: "Nightscape" ("Circular Reality") while the player is in
//   the safe room; it melds with Recovery Mission better than "Mary" did
//   (Timothy 2026-11-01). On the ship that is Command. 1:07 long; its
//   ending fades out from about 1:01.
// - shipWalk: "Exoplanet" ("Circular Reality") on the ship anywhere
//   outside Command: the walking-around-the-ship music (Timothy
//   2026-11-01). Off the ship there is no music outside the safe room.
//   1:46 long; its ending drops away from about 1:41.
export const MUSIC = {
  shipIntro: { src: './audio/ship-intro-recovery-mission.mp3', volume: 1, fadeInMs: 3000, fadeOutMs: 4000, loop: false },
  safeRoom: { src: './audio/safe-room-nightscape.mp3', volume: 1, fadeInMs: 2000, fadeOutMs: 4000, loop: true, loopEndS: 60, crossfadeS: 5 },
  shipWalk: { src: './audio/ship-walk-exoplanet.mp3', volume: 1, fadeInMs: 2000, fadeOutMs: 4000, loop: true, loopEndS: 100.5, crossfadeS: 4 },
};
// How finely music.js draws a fade's curve, and how often it checks which
// tune should be up.
export const MUSIC_FADE_STEPS = 64;
export const MUSIC_CHECK_MS = 250;

export const SAFE_ROOM = {
  hesitateMs: 1500,
  waitMs: 3000,
  hunterLiftMs: 2500,
  dropMs: 700,
  turnMs: 500,
};
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
// `minionKinds`). With the gun on:
//   moveEvery  it moves every this many turns (1 = every turn)
//   size       how big it is drawn, against a tile
//   gold       gold for killing it, before the darkness multiplier
//   killWidth  the dial's kill zone, a share of the circle (kill or maim plan)
//   maimWidth  the dial's maim zone (a maim knocks it down)
//   guard      the first hit only breaks its guard (GUARD_STUN_MOVES)
//   dial       its dial's traits (Timothy, 2026-10-15: the kind tells you
//              what the dial will do): spin 'still' or 'with' (its zones
//              drift along with the marker), turnBack (the marker stops and
//              turns back at random), surge (one side of the dial is faster)
// No health (kill or maim plan, Timothy 2026-10-15): one good hit kills,
// the HUSK's guard takes one more. Widths are drafts for Timothy to tune.
export const MINION_KINDS = {
  SHARD: { moveEvery: 1, killWidth: 0.10, maimWidth: 0.18, size: 0.85, gold: 1, vents: true, dial: { spin: 'still', turnBack: false, surge: true } },
  HUSK: { moveEvery: 2, killWidth: 0.09, maimWidth: 0.20, guard: true, size: 1.15, gold: 3, dial: { spin: 'with', turnBack: false, surge: false } },
  STALKER: { moveEvery: 1, killWidth: 0.07, maimWidth: 0.14, size: 1.0, gold: 2, vents: true, dial: { spin: 'still', turnBack: true, surge: false } },
};
// A hit on a guard breaks it and stuns its minion: longer from the kill
// zone than the maim zone, so the kill zone is still worth aiming for.
export const GUARD_STUN_MOVES = { kill: 2, maim: 1 };
// The order kinds come in on a floor whose recipe names none (or too few).
export const MINION_KIND_ORDER = ['SHARD', 'STALKER', 'HUSK'];
// How many of its last tiles a minion remembers, newest last. A strike
// knocks it back along them, the way it came (the mockup's KNOCKBACK).
export const MINION_TRAIL_LENGTH = 3;
// A minion that reaches the player strikes for MINION_STRIKE_COST
// stability (DARK_MISS_COST in the darkness, like a miss) and is knocked
// back along its trail, up to MINION_TRAIL_LENGTH tiles.
export const MINION_STRIKE_COST = 1;
// A shot that hits (kill or maim zone) stuns the minion: it skips its next
// MINION_STUN_MOVES moves, so it can't walk into the player straight after
// (Timothy). A miss or a harmful zone doesn't stun.
export const MINION_STUN_MOVES = 1;
// Downed stick men (downed plan, Timothy 2026-10-15): a shot in the dial's
// maim zone knocks a stick man down. It crawls toward the player
// on its arms, moving DOWNED_SLOWDOWN times less often than it did
// standing, grabs their ankle if it reaches them, and a bump finishes it.
// DEV -> Downed (DOWNED) switches it off: a 1 HP stick man stays standing.
export const DOWNED = true;
export const DOWNED_SLOWDOWN = 2;
// Steady aim (steady aim plan step A, `ideas/steady-aim-plan.md` outside
// the repo; Timothy 2026-10-27, after Signalis): SELECT is held, not
// tapped, and no dial opens. The aim steadies over
// fullMs (slower on a low battery or in the dark) and climbs from the legs
// to the head; letting go fires. The chance to land climbs with it from
// minChance to 1 at full hold: below full a hit maims, at full it kills.
// A miss in the first `wildBelow` of the hold is a harm (HARM_KINDS). Held
// on the head past shakeAfterMs the arm shakes and the chance falls toward
// shakeFloor; at dropAtMs it drops back to `dropTo`. The world never stops
// for it, and the player stands still while aiming (Timothy's calls,
// 2026-10-28: the aim climbs with time, stand still, a wild early miss,
// no change by depth). While it steadies the light narrows to a beam
// (step B, Timothy's call): the cone's half-angle runs from LOOK_CONE_HALF
// to `beamHalf` and its slack from LOOK_CONE_SLACK to `beamSlack` with the
// aim, and the beam stays on the stick man. A kind in `kindSlow` steadies that much slower on
// it: the STALKER weaves. `on` is the start setting, the default since
// step C (DEV -> Steady aim, or ?aim=steady / ?aim=dial). One stick only:
// the start screen's Turns option keeps the dial, as does the Struggle.
export const STEADY_AIM = {
  on: true,
  fullMs: 1000,
  minChance: 0.05,
  wildBelow: 0.3,
  shakeAfterMs: 700,
  dropAtMs: 1600,
  shakeFloor: 0.4,
  dropTo: 0.55,
  lowBattery: 0.75,
  dark: 0.55,
  kindSlow: { STALKER: 0.8 },
  beamHalf: Math.PI / 16,
  beamSlack: 0.1,
};
// How much of a crawl (MAP_ANIMATION_MS.crawl) the leading hand takes to
// reach and plant before the body starts to drag (mapview.js holds the
// slide back that long), and how many turns the letters it drops on the
// tile it left take to fade.
export const CRAWL_REACH = 0.35;
export const DOWNED_DROP_TURNS = 3;
// Minions are placed when a room loads (no summoning; how many is in the
// floor recipe) and roam freely: they wander at random and only chase once
// the player is within MINION_CHASE_RANGE walkable steps. That is the rule
// in Comfort mode and with DEV -> Light battery off; with the battery in
// play (light battery plan step B, combat.js notice) a stick man chases
// once it has a clear line, within MINION_LIGHT_SIGHT tiles, to the player
// or a tile their light is on (with the light on). Out of view it walks to
// where it last saw them, then searches round there for MINION_TRACK_TURNS
// turns before it loses them.
export const MINION_CHASE_RANGE = 4;
export const MINION_LIGHT_SIGHT = 7;
export const MINION_TRACK_TURNS = 5;
// Grates (vents and noise plan step A, vents.js): up to VENT_PAIRS pairs a
// floor, each joining two rooms at least VENT_MIN_APART walking steps
// apart, so the duct is a real short cut (Timothy: random, never the start
// room or the core).
export const VENT_PAIRS = 2;
export const VENT_MIN_APART = 12;
// The ducts (vents and noise plan step C, vents.js): a hunting stick man
// that fits (MINION_KINDS `vents`: SHARDs and STALKERs, and the hunter;
// HUSKs are too big) is in a duct VENT_TURNS turns. On the first the far
// grate shudders, on the next it drops out beside it: one turn of warning.
// The player hears the shudder when the grate is in sight or within
// VENT_RATTLE_HEARD tiles.
export const VENT_TURNS = 2;
export const VENT_RATTLE_HEARD = 6;
// Noise (vents and noise plan step B, noise.js): a mistake makes a sound
// that spreads this many walking steps from the player (walls stop it,
// doorways carry it, a grate passes it to its pair). Only mistakes are
// loud (Timothy): shots and steps are quiet, and a wrong answer in a fight
// makes no noise.
export const NOISE_RANGES = {
  reload: 6,   // a wrong reload answer: the gun jams
  relay: 8,    // a wrong relay answer: it sparks
  loud: 5,     // the dial stopped in a loud zone
  struggle: 4, // a lost Struggle
  gate: 10,    // a wrong answer at the gate
  lure: 10,    // a room spot's lure set off (spots.js soundLure): the tap on full
};
// Cover (Timothy 2026-10-26, sight.js): crouched (One stick: sneaking or
// creeping) with something solid beside them, the player is quieter: a
// mistake's sound spreads `noiseShare` of its NOISE_RANGES (at least a
// step). Stick men on the far side of that cover can't notice them at all.
export const COVER = { noiseShare: 0.5 };
// Noise is on by default; DEV -> Noise switches it off (mistakes are quiet).
export const NOISE = true;
// DEV -> Show ducts: who is in a duct, and every pair known. Off by default.
export const SHOW_DUCTS = false;
// Room spots (room spots plan, spots.js; Timothy 2026-10-28): what a
// plan's spot may hold, and how often one holds nothing ("33% of the time
// it has nothing I think is fair").
export const SPOT_KINDS = ['hide', 'takedown', 'lure', 'scout'];
export const SPOT_EMPTY_CHANCE = 0.33;
// A takedown pays the stick man's own gold this many times over (Timothy
// 2026-10-28: gold, x2; a kill with the book pays it once and costs energy).
export const TAKEDOWN_GOLD_TIMES = 2;
// DEV -> Spots: each spot marked with what it rolled. Off by default.
export const SHOW_SPOTS = false;
// Static (static.js, staticview.js; Timothy 2026-10-19): a faint grain
// over the map as the closest stick man nears, in place of "I see you.".
// On by default; DEV -> Static switches it off.
export const STATIC_NOISE = true;
// The warning timer (warning.js, presence cues plan step D): a DEV tool,
// off by default (DEV -> Warning timer). A stick man's signs out of view
// `forgetMs` are forgotten, so his next one starts a new approach.
export const WARNING_TIMER = { on: false, forgetMs: 3000 };
export const STATIC = {
  startSteps: 5,      // walking steps from the closest stick man where it begins, about as far as the light reaches (Timothy: 7 put grain on ordinary walking)
  curve: 1.3,         // strength = share of the way in, to this power: quiet far off, rising near
  grain: 0.14,        // the grain's strength at full: a thin veil, the map always readable (Timothy: v1 hid everything)
  band: 0.04,         // a faint lighter band rolling down the screen at full
  easeMs: 500,        // the strength eases toward a new level over about this long, never a jump
  driftMs: 600,       // each grain frame crossfades into the next over this long (slow, no flicker)
  bandMs: 6000,       // the band takes this long to roll down once
  grainSize: 3,       // CSS pixels per grain
  letters: 0.25,      // wrong letters start at this strength
  letterHoldMs: 1400, // a wrong letter holds this long, then turns back
  letterGapMs: [2500, 5500], // the wait between tries, picked at random in this range; each try comes off with the strength's chance
};
// The wrong letters' lookalikes (mockup v2, Timothy picked them): mirrored
// where a mirror exists, else a near shape. Capitals for HUD labels,
// small letters for the room log.
export const STATIC_LOOKALIKES = {
  E: 'Ǝ', R: 'Я', N: 'И', S: 'Ƨ', Y: 'У', I: '1', O: '0', A: 'Λ',
  e: 'ɘ', a: 'ɒ', s: 'ƨ', b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n', o: '0',
};
// An idle stick man walks to a spot in another room, stands there for a
// number of turns in this [min, max] range, then picks a new room (smarter
// enemies step 2, Timothy 2026-10-15: random steps each turn looked like
// twitching in place).
export const MINION_LINGER_TURNS = [2, 4];
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
// The record book (record book plan, ideas/record-book-plan.md outside the
// repo): the ask screen drawn as a book with a dark page and the light tube
// on its left edge (bookview.js). `paper` is the page the book opens with;
// DEV -> Book paper cycles `papers` to compare them (Timothy picked dark,
// 2026-10-27). A page turns sideways over the spine (pageturn.js, step B):
// `turnMs` long (his "moderately"), in `frames` stepped frames like a
// sprite's, a dog-ear at the bottom-right corner for the first `dogEarShare`
// of it, the lifted sheet leaning `flapLean` of the turned width toward the
// spine.
export const BOOK = {
  paper: 'dark',
  papers: ['dark', 'cold', 'cream'],
  turnMs: 360,
  frames: 11,
  dogEarShare: 0.2,
  flapLean: 0.55,
  tubeWarmMs: 700,   // the HUD tube's switch-on (step E): cells and glow fade up, never flicker
};
// Shots in the dark (light battery plan step C, gun.js fireDark): the shot
// goes along the aim, checked every DARK_SHOT_STEP tiles for the first
// thing in the way. Its dial always hides DIAL_DARK_ARC of the circle, and
// is one step harder at random: a lap in DARK_SWEEP_SCALE of the time
// (faster, never past DIAL_LAP_LIMIT_MS), or one more harmful zone.
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
// Always on since 2026-10-28 (its DEV toggle retired).
export const LOOK_FREE_ARC = Math.PI / 6;
// Eight ways (eight ways plan): the player and the stick men walk and face
// the 4 grid ways and the 4 diagonals between them. A diagonal step needs
// both tiles it passes between free of walls and pillars (passage.js
// canPassCorner). Always on since 2026-10-28 (its DEV toggle retired).
// The cone's half-width, and the slack each tile gets (sight.js inLookCone:
// atan2(LOOK_CONE_SLACK, distance)) so an off-angle cone isn't ragged.
export const LOOK_CONE_HALF = Math.PI / 4;
export const LOOK_CONE_SLACK = 0.35;
// The look controls (free look plan step C). The d-pad's centre is a look
// stick (dpad.js initLookStick): a drag past LOOK_STICK_DRAG_PX sweeps the
// light (or looks up), its knob following up to LOOK_STICK_KNOB_PX; a tap
// turns the body when the aim is past the arc. A press held
// LOOK_STICK_HOLD_MS waits (it was two taps). The light has its own
// button since 2026-10-27 (3 taps on a stick switched it before). On the
// map (mapview.js onMapPointer), a press that moves past MAP_DRAG_PX is a
// drag, not a tap. A finger's tap wobbles: at 6 px, a tap on a
// phone became a small drag that re-aimed the light and never turned.
export const LOOK_STICK_DRAG_PX = 14;
export const LOOK_STICK_KNOB_PX = 18;
export const LOOK_STICK_HOLD_MS = 1000;
export const MAP_DRAG_PX = 8;
// A tap on the floor this close to the player's own tile (in tiles)
// doesn't aim: the angle would jump about under it.
export const LOOK_POINTER_DEAD = 0.35;

// The warning (combat.js senseUnseen, "I see you."): a minion or the hunter
// the player can't see, SENSE_STEPS walkable steps away and due to move next
// turn, so its next move puts it right beside them. Once per approach.
export const SENSE_STEPS = 2;
// How long "I see you." stays on the map before it fades (render.js showSensed).
export const SENSE_NOTE_MS = 2600;
// The answer swirl (answer swirl plan, ideas/answer-swirl-plan.md outside the
// repo): after a wrong answer, with Reveal on, the right answer shows over
// the map until the player's next move. How long the answer line takes to
// fade once they move (keep in step with .answer-note in index.html), after
// which it is taken off the map and "I see you." moves back up.
export const ANSWER_LINE_FADE_MS = 1600;
// The answer ring (step B, swirl.js): a short answer circles over the thing
// that asked it instead. Up to ANSWER_RING_MAX_LETTERS letters and digits
// rings (a draft number: tune after play); longer is the line. The answer
// repeats round the ring to at least ANSWER_RING_MIN_CHARS characters, so
// one copy is always passing along the front. One turn every
// ANSWER_RING_TURN_MS, slow enough to read. It comes in, letter by letter,
// over ANSWER_RING_IN_MS and fades over ANSWER_RING_OUT_MS after a move.
export const ANSWER_RING_MAX_LETTERS = 10;
export const ANSWER_RING_MIN_CHARS = 20;
export const ANSWER_RING_TURN_MS = 8000;
export const ANSWER_RING_IN_MS = 900;
export const ANSWER_RING_OUT_MS = 1000;
// Its shape, in tile widths (shoulderview.js drawAnswerRing): the ring's
// half-width over a minion, chest or box and round the boss, its letters'
// size, and how high it sits (over the head; round the boss, at its chest).
// The far side shrinks to backSize and dims to backLevel; the near letters
// are never under minPx CSS px, so it still reads on a phone.
export const ANSWER_RING = { radius: 0.62, bossRadius: 0.7, size: 0.26, minPx: 14, lift: 0.95, bossLift: 0.35, depth: 0.3, backSize: 0.68, backLevel: 0.22 };

// The tutorial room (tutorial.js, tutorial chamber plan).
// Turns in the dark before the light falls from above on its spot.
export const TUTORIAL_SPOT_TURNS = 4;
// How far the light from above reaches round its middle, in tiles (3 x 3).
export const TUTORIAL_SPOT_RADIUS = 1;
// How close to the light's middle (in steps) counts as walking to it: the kind voice speaks and the barrel appears.
export const TUTORIAL_SPOT_NEAR = 2;
// The stick man that comes after the name: a slow kind (moves every other
// turn), without its guard (tutorial.js), so a maim drops it and a kill ends it.
export const TUTORIAL_MINION_KIND = 'HUSK';
// The DEV test rooms' stick man (testroom.js): slow, as the tutorial's, so
// there is time to watch what a mechanic does.
export const TEST_ROOM_MINION_KIND = 'HUSK';
// The advanced tutorial's sneak station (advanced.js): how many of the
// stick man's steps the player must stay crouched in cover, in his sight
// but unseen, for the door to open.
export const ADVANCED_COVER_STEPS = 3;
// How long a tutorial line stays on the map before it fades (slowly: render.js showWhisper).
export const TUTORIAL_WHISPER_MS = 5000;
// After "Die in darkness.", how long until the kind voice: "Don't let them dim your light."
export const TUTORIAL_KIND_DELAY_MS = 3000;
// In Comfort mode (the light is always on), how long after the kind voice the ring breaks by itself.
export const TUTORIAL_COMFORT_BREAK_MS = 2500;
// How long a tutorial stage can go on before its plain hint shows in the room log (only for a player who is stuck).
export const TUTORIAL_STUCK_MS = 15000;
// The ring of words round the player (shoulderview.js drawDarkRing): its distance from them in tiles,
// ms for one slow turn round, and how long they take to scatter when the light breaks it.
export const TUTORIAL_RING_RADIUS = 1.4;
export const TUTORIAL_RING_TURN_MS = 24000;
export const TUTORIAL_RING_SCATTER_MS = 1400;

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
// A run that starts by leaving the tutorial room starts with this much instead (Timothy, 2026-10-13).
export const TUTORIAL_EXIT_ENERGY = 2;
export const GUN_RELOAD_MODIFIERS = ['blind', 'flip', 'timer'];
export const RELOAD_ENERGY = [2, 3, ENERGY_MAX];
// A landed shot's dial (kill or maim plan, Timothy 2026-10-15; replaces the
// damage bar): a circle with one kill zone and one maim zone sized by the
// minion kind (MINION_KINDS killWidth / maimWidth), and harmful zones
// (HARM_WIDTH each, a random HARM_KINDS kind) at new spots each shot
// (gun.js dialZones). Anywhere else misses. DIAL_DEPTHS, per danger depth
// (the last row carries on past the table): `scale` for the kill and maim
// zones, `harms` (how many harmful zones), `speed` (a DIAL_LAP_MS name)
// and `lapLimit` (laps before it fires by itself; 0 = none). Zones keep
// DIAL_ZONE_GAP from each other. Drafts for Timothy to tune.
export const DIAL_DEPTHS = [
  { scale: 1, harms: 0, speed: 'normal', lapLimit: 0 },
  { scale: 0.9, harms: 1, speed: 'normal', lapLimit: 0 },
  { scale: 0.8, harms: 2, speed: 'fast', lapLimit: 3 },
];
export const DIAL_ZONE_GAP = 0.04;
// Speed is a lever with a limit (Timothy): ms for the marker to go once
// round at each speed, and DIAL_LAP_LIMIT_MS, the fastest any dial may go
// (the Struggle included). Reduced motion makes every lap DIAL_REDUCED_SCALE
// times as long (gunpanels.js).
export const DIAL_LAP_MS = { slow: 3000, normal: 2000, fast: 1500 };
export const DIAL_LAP_LIMIT_MS = 1100;
export const DIAL_REDUCED_SCALE = 2;
// Harmful zones (Timothy: three kinds): jam loses 1 more energy, loud
// makes a noise (NOISE_RANGES.loud), lunge brings the minion one step
// closer at once (combat.js lungeAt).
export const HARM_KINDS = ['jam', 'loud', 'lunge'];
export const HARM_WIDTH = 0.08;
// The dark arc: the share of the dial a shot in the dark (or on a low
// battery: LOW_BATTERY_CHARGE charge left with the light on) hides.
export const DIAL_DARK_ARC = 0.25;
export const LOW_BATTERY_CHARGE = 1;
// How the dial shows (dialview.js, gunpanels.js; kill or maim plan step B):
// a veil over the map fades in over DIAL_FADE_IN_MS with READY in its
// middle, and after a stop the result holds DIAL_RESULT_MS, then fades out
// over DIAL_FADE_OUT_MS. The dial is DIAL_SIZE_SHARE of the map's shorter
// side. Drafts for Timothy to tune.
export const DIAL_FADE_IN_MS = 700;
export const DIAL_RESULT_MS = 900;
export const DIAL_FADE_OUT_MS = 500;
export const DIAL_SIZE_SHARE = 0.9;
// The kind traits as the dial plays them (MINION_KINDS dial):
// - drift (spin 'with', the HUSK): the zones turn DIAL_DRIFT_LAPS a second
//   the way the marker goes (none under reduced motion);
// - surge (the SHARD): round DIAL_SURGE_AT (0 = top, clockwise; 0.75 is
//   the left side) the marker goes up to 1 + DIAL_SURGE_BOOST times as fast;
// - turn back (the STALKER): the marker stops DIAL_TURN_PAUSE_MS (the
//   tell; DIAL_TURN_PAUSE_REDUCED_MS under reduced motion) and goes back the
//   other way, first after DIAL_TURN_FIRST_MS, then every DIAL_TURN_EVERY_MS
//   (a random time between the two numbers).
export const DIAL_DRIFT_LAPS = 0.12;
export const DIAL_SURGE_AT = 0.75;
export const DIAL_SURGE_BOOST = 1.3;
export const DIAL_TURN_PAUSE_MS = 280;
export const DIAL_TURN_PAUSE_REDUCED_MS = 500;
export const DIAL_TURN_FIRST_MS = [600, 1600];
export const DIAL_TURN_EVERY_MS = [900, 2500];
// Where the dark arc sits on the dial: centred here (0.5 = the bottom),
// DIAL_DARK_ARC wide. It stays put; drifting zones pass through it.
export const DIAL_DARK_AT = 0.5;
// The guard ring's letters (dialview.js) go round once in this many ms
// (still under reduced motion).
export const DIAL_GUARD_TURN_MS = 9000;
// Energy cells (drawn as a drum on the map; decor.js placeEnergyCells):
// each room of a floor gets one at this chance, then rooms without one are topped up
// until the floor has at least ENERGY_CELLS_MIN. Bumping one opens the
// reload panel; any answer uses it up. Only placed with the gun on.
// Drafts for Timothy to tune.
export const ENERGY_CELL_ROOM_CHANCE = 0.35;
// Struggle (Timothy's design): a minion or the hunter that reaches the
// player while they have no energy doesn't just strike. It gets a dial of
// its own (kill or maim plan: the same dial as a shot): one zone
// STRUGGLE_ZONE_WIDTH of the circle at a random spot, a lap in
// STRUGGLE_LAP_MS; stopping in it pushes the minion back STRUGGLE_PUSHBACK
// tiles with no damage to it, anything else and it strikes as usual.
// Each Struggle after the first on the same floor is harder (Timothy:
// relying on it shouldn't stay easy): a lap STRUGGLE_SPEEDUP_MS faster,
// never past DIAL_LAP_LIMIT_MS, and a zone STRUGGLE_SHRINK narrower, never
// under STRUGGLE_MIN_WIDTH. A new floor starts again from the first.
// Drafts for Timothy to tune.
export const STRUGGLE_ZONE_WIDTH = 0.2;
export const STRUGGLE_LAP_MS = 1500;
export const STRUGGLE_PUSHBACK = 3;
export const STRUGGLE_SPEEDUP_MS = 100;
export const STRUGGLE_SHRINK = 0.02;
export const STRUGGLE_MIN_WIDTH = 0.1;
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
// at the gate in place of a random one, HAUNT_CHANCE of the
// time, once at least HAUNT_MIN_GAP other questions have been answered
// since the miss. Right silences it; wrong keeps it waiting.
export const HAUNT_CHANCE = 0.35;
export const HAUNT_MIN_GAP = 3;

// The hunter: HUNTER_SPAWN_DELAY turns after the boss falls, something
// that can't be killed wakes on the tile farthest from the player and
// hunts them from anywhere, one step per turn — the player's own pace, so
// someone who keeps moving stays ahead, and every box opened or dead end
// lets it gain. A landed shot stops it for HUNTER_REST_TURNS (gun.js
// staggerHunter).
export const HUNTER_SPAWN_DELAY = 4;
export const HUNTER_REST_TURNS = 8;
// Pairs of modifiers for the gate's questions with fewer keys held (gate.js
// gateModifierCount). Gambler is left out: a wager on top of a two-heart
// miss is too harsh, and Blind could hide the question while the wager is
// being placed.
export const HUNTER_MODIFIER_PAIRS = [['blind', 'flip'], ['blind', 'timer'], ['flip', 'timer']];

// Question modifiers: each query category offered at the start of a fight
// may carry one, shown as a small tag beside it, so the player can
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
// Fuel Mix (ship minigames plan step A; the Pilot's job): pour tanks of
// 1, 10, 100 ... into the engine until it holds the number answer. The
// tanks are the powers of ten up to the answer's own (never fewer than
// 1 / 10 / 100). Par = the answer's digits added up (950 = 14 pours).
// Each vent (going over empties the engine) counts as `ventCost` extra
// pours. Pours over par (plus vents) score: 0 = X, up to `slack2` = 2, up
// to `slack1` = 1; beyond, the engine runs dry: a miss. Whole answers up
// to `maxAnswer`. From panic level `hideTotalAt` (Shaken) the running
// total hides: only UNDER / OVER is left. `ventMs`: how long OVER shows
// before the engine reads empty again.
export const FUEL_MIX = { minTanks: 3, ventCost: 1, slack2: 3, slack1: 8, maxAnswer: 999999, hideTotalAt: 2, ventMs: 900 };
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
// Scanner (ship minigames plan step B; the Sensors' job, in place of Fog
// Reveal): the picture under a fog of `cols` x `rows` patches, and the
// player picks which to scan. The share of the picture scanned sets the
// tier: up to `xShare` = X, up to `twoShare` = 2, more = 1. A wrong option
// dims and steps the tier down one; more than `wrongsAllowed` wrong is a
// miss. From panic level `panicAt` (Shaken) the fog is finer
// (`panicCols` x `panicRows`): each scan shows less, the shares stay.
export const SCANNER = { cols: 5, rows: 4, panicCols: 10, panicRows: 8, panicAt: 2, xShare: 0.2, twoShare: 0.4, wrongsAllowed: 1 };
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
  downed: 0.45, // Simple enemies: a downed minion's small e
};
// Simple enemies: a downed minion's e is this bright (full while it holds
// the player) and sits this far lower on its tile, in tile widths.
export const DOWNED_GLYPH_LEVEL = 0.65;
export const DOWNED_GLYPH_LIFT = -0.08;
// The room view sizes its glyphs (roomview.js drawGlyphs) so
// they are never smaller than they were on the old isometric map, which
// fit ISO_TILES_ACROSS tile widths across the map (ISO_TILES_ACROSS_NARROW
// on a map narrower than ISO_NARROW_MAP_WIDTH CSS pixels, a phone).
export const ISO_TILES_ACROSS = 9;
export const ISO_TILES_ACROSS_NARROW = 7;
export const ISO_NARROW_MAP_WIDTH = 400;
// Windows on back walls that face the outside (windows.js, room view plan
// step F): one every `every` columns along such a wall, and the pool of
// light each throws: `length` tiles down from the wall, leaning `slant`
// tiles across as it goes, `inset` tiles in from the window's sides. Its
// light shows stick men as the player's own does (sight.js canMakeOut).
export const WINDOW_LIGHT = { every: 3, length: 3.4, slant: 1.1, inset: 5 / 16 };
// Lamps a fixed plan puts down (lamps.js, plans.js `L`; presence cues plan
// step A, Timothy 2026-10-28): each lights the floor within `radius` tiles
// of it, and a stick man in that light is seen from as far as `seeFrom`
// tiles (any way, diagonals included) with a clear line, about as far as
// the room view shows, past REVEAL_DISTANCE and from outside the room.
export const LAMP_LIGHT = { radius: 2, seeFrom: 10 };
// Shadows (shadows.js, presence cues plan step C): a lamp within `castFrom`
// tiles with a clear line to a stick man, or a window whose pool he stands
// in (its light from `windowHigh` tiles above the window), throws his
// shadow away from it: `base` tiles long and `perTile` longer for each
// tile he stands from the light; none closer than `minFrom` (right under
// it). Measured every `sample` tiles. Subtle (Timothy 2026-10-28: a help
// to notice one moving through light, not a mark in the dark): drawn only
// on floor that is lit (visibleSet), `dark` over it at
// his feet, `tipDark` at its tip (the part that reaches the player's light
// first, so it mustn't fade away), `width` tiles wide there; where it
// falls glides after him over
// `glideMs` a tile (at once under reduced motion), so it never jumps.
export const SHADOW = {
  castFrom: 5, windowHigh: 1.5, base: 2.5, perTile: 0.5, minFrom: 0.3, sample: 0.25,
  dark: 0.35, tipDark: 0.25, width: 0.5, glideMs: 400,
};
// The pieces of furniture a fixed plan can stand in its rooms (plans.js
// `furniture`, room view plan step E). Each has a bump line in text.js
// (`furniture.<piece>`) and a drawing in roomview.js.
export const FURNITURE_PIECES = ['desk', 'teacher', 'shelf', 'table', 'bench', 'easel', 'sink', 'stall', 'sofa'];
// The room view (js/roomview.js, room view plan `ideas/room-view-plan.md`
// outside the repo; the game's map view since step G): a fixed camera looking
// down on one room at a time, drawn as pixel art at tilePx a tile and
// scaled up by a whole number. Light levels run from 0 (black) to 1.
export const ROOM_VIEW = {
  tilePx: 16,         // the picture's own pixels per tile, before scaling up
  minAcross: 15,      // the scale-up is the biggest whole number that still shows this many tiles across...
  minDown: 11,        // ...and this many down...
  minAcrossTall: 11,  // ...or this many across on a map taller than wide (a phone): a School room and its rim
  faceRows: 2,        // a back wall's face is up to this many tiles tall (only over wall, never over floor)
  hallReach: 6,       // in a hallway, "the space you're in" is hallway floor up to this many steps away
  litNear: 1,         // a lit tile beside you...
  litFar: 0.55,       // ...and one PLAYER_CONE_RANGE away
  room: 0.28,         // the rest of the room you're in: dim, so you see its shape
  remembered: 0.1,    // explored tiles elsewhere
  shipLit: 0.7,       // the ship's steady light on every floor tile (ship plan: no dark areas)
  ember: { radius: 1.3, level: 0.45 }, // the warm glow round the player's head, radius in tiles
  glideMs: 180,       // the camera glides to a new room this fast (jumps under reduced motion)
  stickHeight: 1.25,  // the player's stick man, in tiles
  footAt: 0.78,       // his feet stand this far down his tile, so he rises over the tile behind
  lookUpMs: 120,      // looking up (sky eye plan): the sky fades in and out this fast (at once under reduced motion)
};
// Looking up with the look stick (sky eye plan step A): a push up past this
// share of its reach, more up than sideways, looks up until it comes back.
export const LOOK_UP_STICK = 0.6;
// The player's stick man (player figure plan, `ideas/player-figure-plan.md`
// outside the repo; js/playerform.js): a person feeling their way through
// a dark place, never quite even (Timothy, the ember head mockup v4).
// Distances in tiles, from his middle along the way he walks (`along`) and
// across it (`side`); drops and sways as shares of his height.
export const PLAYER_WALK = {
  stride: 0.15,       // each foot forward or back of his middle, mid-step
  stance: 0.045,      // each foot to the side: close, so he doesn't crab walk
  lift: 0.025,        // how high the moving foot lifts
  strideRange: [0.78, 1.1], // each step's length, a share of the stride, a little different every step
  backShare: [0.8, 0.95],   // how far back the planted foot ends, a share of the step
  sideJitter: 0.03,   // where a foot lands across the way, give or take
  liftRange: [0.6, 1.4],    // each step's lift, a share of `lift`
  timeRange: [0.95, 1.1],   // each step's time, a share of the slide's (the feet may lag the body, never the other way)
  firstScale: 0.6,    // the first step after standing is this much shorter...
  firstSlow: 1.25,    // ...and this much slower: testing the floor
  restMs: 900,        // standing this long makes the next step a first step
  gatherWaitMs: 160,  // when he stops, the back foot steps up beside the front one after this...
  gatherMs: 380,      // ...taking this long
  bumpScale: 0.4,     // a bump into a wall is a half step: the foot comes back down
  settleMs: 320,      // after each step the weight settles, dipping this long...
  settle: 0.012,      // ...this far
  spreadDrop: 0.02,   // the body is this much lower with the feet a whole stride apart
  hunch: 0.035,       // walking and for a while after (alertMs), he hunches this much...
  alertMs: 2600,
  scan: 0.35,         // ...and his head scans side to side this far (a share of a glance)
  sway: 0.016,        // his weight shifts over the planted foot this far
  gunLag: 0.2,        // the gun follows the body this share of the way each frame
  armSwing: 0.12,     // without the gun, each hand swings this far against its foot...
  armSide: 0.15,      // ...this far out to the side
};
// The player's breath: lifting his chest `lift` of his height, quicker
// after walking (`fastMs` a breath), calming to MAP_ANIMATION_MS.playerBreath
// over `calmMs`.
export const PLAYER_BREATH = { lift: 0.02, fastMs: 1700, calmMs: 5000 };
// The player's ember head (player figure plan step B, Timothy's pick E):
// dark inside, with a soft glow in the middle in his own white light,
// brightening from `low` to `high` and back with each breath (`mid` under
// reduced motion), reaching `reach` head radii, and leaning `lean` of the
// head's radius the way he looks.
export const PLAYER_EMBER = { low: 0.4, high: 0.65, mid: 0.52, reach: 1, lean: 0.35 };
// The player's glances, standing still for MAP_ANIMATION_MS.playerIdle: at
// odd times (gapMs apart), to a random side, of a random size (`size`, a
// share of `turn`, the head's shift as a share of its radius), and a
// `twiceShare` of them look, turn back and look again.
export const PLAYER_GLANCE = {
  turn: 0.8, size: [0.55, 1], onceMs: [900, 2000], twiceMs: [1800, 2600], twiceShare: 0.3, gapMs: [1500, 6000],
};
// The eye in the sky (sky eye plan, `ideas/sky-eye-plan.md` outside the
// repo; the old top-bar eye in the shoulder view): straight overhead, seen
// by looking up. Shut when a floor begins, opening as the boss's light
// spreads (mapshared.js skyEyeOpen), twitching near the end.
export const SKY_EYE = {
  elevation: 1.25,  // how high in the sky it hangs, in radians above level, the way the light points (just above the middle of the view looking up)
  size: 0.13,       // its half width, as a share of the map's width
  lid: 0.62,        // its lids open this far apart at most, as a share of its half width
  iris: 0.42,       // the iris's radius, as a share of its half width
  look: 0.22,       // how far the pupil turns toward the player, as a share of its half width
  halo: 2.2,        // its glow reaches this many half widths
  twitchAt: 0.8,    // it twitches from this much open...
  twitchMs: 2400,   // ...once in this long (never under reduced motion)
  twitch: 0.04,     // by this share of its half width each way
  paleFrom: 0.5,    // the sky pales faintly blue from this much open
  tutorial: 1,      // how open it is in the tutorial room (Timothy: wide open, so "It's watching you." shows an open eye is bad)
};
// The light's sweep (shoulder view plan step B, kept for the look stick):
// pushed fully sideways it sweeps the light round this fast (radians a
// second; 144° a second), and a quick tap sweeps at least LOOK_SWEEP_TAP.
// Past the free arc each body turn is a turn (look.js sweepLook).
export const LOOK_SWEEP_SPEED = Math.PI * 0.8;
export const LOOK_SWEEP_TAP = Math.PI / 12;
// How long each map animation takes, in ms. Looping ones stand still
// under reduced motion.
export const MAP_ANIMATION_MS = {
  slide: 300,       // a minion stepping to the next tile
  step: 140,        // the player stepping to the next tile: short, so walking stays quick. A grid N/E/S/W step; smooth walk (walkpace.js) scales the others by their length on screen
  bump: 180,        // the player walking into something, out and back
  bossPulse: 2000,  // the boss's glow swelling and fading
  warp: 3600,       // the slight wrongness of the boss's and a minion's shape
  hunterWarp: 1600, // the same warp, faster: the hunter is never still
  exchangeWarp: 7000, // the same warp, slow: THE UNFOLDING never quite settles into one shape
  glitchBar: 6500,  // how often a minion's signal drops out
  coinBob: 1400,    // the coin lifting and settling
  glow: 1800,       // the stairs' and THE UNFOLDING's glow
  cellBreath: 4000, // an unused energy cell's faint glow swelling and fading (Timothy: eerie, keep it)
  deskGlow: 6000,
  chargerGlow: 5000, // the charger's cell window breathing in the kind voice's warm light while energy isn't full (charger.js)   // the unused reflective desk's pool of the player's own light, swelling and fading: slow and calm, it is safe (desk.js)
  mist: 14000,      // the boss mist's slow drift, there and back
  target: 1100,     // the box round the thing being fought
  playerBreath: 2600, // the stick man's chest rising and falling
  playerIdle: 3000, // how long the player stands without moving or turning before the stick man starts glancing round (playerform.js, PLAYER_GLANCE)
  gunShot: 260,     // the shot's flash from the gun to where it went, fading (gun plan)
  gunMiss: 900,     // MISS floating up over a minion the shot missed, fading
  soundStep: 110,   // a mistake's sound reaches one walking step further (noise.js); all at once under reduced motion
  soundFade: 1100,  // each tile of the sound fading once reached
  heardMark: 1800,  // the small '!' over a stick man that heard it, fading
  ventRattle: 900,  // a grate shuddering, slowly, the turn before something drops out (vents.js); still under reduced motion and Comfort mode
  ventDrop: 260,    // a stick man climbing out of a grate onto the tile beside it
  darkFlash: 700,   // a stick man hit in the dark, shown in the shot's flash (light battery plan step C)
  bookOpen: 350,    // the book lifted from his side and opened once something can be shot (roomgun.js holdBook); at once under reduced motion
  bookPush: 150,    // a shot pushing the book out from reading close to pointing at the enemy
  bookPoint: 600,   // the book held out at the enemy after a shot
  bookBack: 350,    // the book coming back to read close
  bookTurn: 700,    // a page turning from right to left as a shot goes; not under reduced motion
  // Minions as stick men (stick enemies plan, js/stickforms.js). Slow on
  // purpose: the calm rule for motion- and flicker-sensitive players.
  stickTell: 900,    // a stick enemy eases into its tell pose, or back out (stickforms.js)
  stickTurn: 700,    // a stick enemy turns to face the player when they pass to its other side
  stickHit: 500,     // a hurt stick enemy's soft brightening and one small push
  stickDeath: 2400,  // a killed stick enemy's lines fading while six tendrils grow, go limp and fade
  downedFall: 1600, // a stick man going down (downed plan step B): from its pose to propped on its arms, legs coming apart into letters
  crawl: 1000,       // a downed one's move: a hand reaches and plants, the body drags up, the other hand catches up
  grab: 900,         // a downed one's hand reaching for the player's ankle
  downedFinish: 2000, // a finished one: each line turns to letters that settle to the floor and fade
};
// The minimap (minimapview.js): a tile is at most MINIMAP_MAX_UNIT CSS px
// from its centre to its side point, and the plan keeps MINIMAP_PAD px
// from the map's edge.
export const MINIMAP_MAX_UNIT = 9;
export const MINIMAP_PAD = 12;
// The arrow from the player's dot to where the light points: its reach and its half width, in minimap tiles (never under 16
// and 5 pixels).
export const MINIMAP_ARROW = [1.6, 0.55];
// On a fixed plan (plans.js) the minimap names the rooms the player has
// walked into, in MINIMAP_LABEL_PX text, and the building in
// MINIMAP_TITLE_PX text in its top-left corner. CSS px.
export const MINIMAP_LABEL_PX = 15;
export const MINIMAP_TITLE_PX = 22;
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

// 3D moves (one stick plan step F, figure3d.js): the stick men move with
// Quaternius's animations (moves3d.js), drawn at the room's own pixels.
// `heightM`: the figure's height in metres, the player's ROOM_VIEW
// stickHeight (so a metre is about 11 room pixels). `depth`: a metre toward
// the camera moves this share of a metre down the screen. `blendMs`: one
// move blends into the next this long. `walkLoopM`: the ground one loop of
// a walk covers, so the feet stay planted (the legs follow the ground
// covered, not the clock). `stopMs`: still this long, a walker stands.
// `headPast`: the head's middle sits this far past its joint, in metres.
// `turnRate`: radians a second a stick man turns to face its way.
// `punchPeak`: the reach's frame with the fist furthest out; a reach plays
// up to it and holds there until it lands or misses.
export const FIGURE3D = {
  heightM: 1.75,
  depth: 0.55,
  blendMs: 200,
  walkLoopM: { Walk_Loop: 1.3, Crouch_Fwd_Loop: 1.54 },
  stopMs: 150,
  headPast: 0.09,
  turnRate: 8,
  punchPeak: 4,
};

// One stick (one stick plan, ideas/one-stick-plan.md outside the repo):
// the player walks freely in real time (walk.js), not tile to tile. The
// default since step G (`on`); the start screen's Turns option
// (state.settings.oneStick false) keeps the game in turns, and DEV -> One
// stick flips it in play. It turns Real time on. `walkMs` / `sneakMs`: ms to walk / creep one
// tile (the mockup's quick and natural paces). `creep`: a push on the
// stick under this share of its reach creeps (0.6 -> 0.8, Timothy
// 2026-10-27: on the phone a sneak kept turning into a walk). `body`: how far the
// player's body reaches from their centre each way, in tiles, for walls
// and furniture. `bumpProgress`: a push that gets less than this share of
// its way is a bump into what stopped it (sliding along a wall isn't).
// `bumpRepeatMs`: pushing on into the same thing bumps it again this
// often. `frameMs`: the most one frame may move the player (a slow tab
// never jumps them through anything).
// Step B: `turnRate`: radians a second the light and body swing round
// toward where the player goes (they hold when they stop). `tapMs`: a move
// key let go sooner than this only turns them, no step. `deadZone`: a push
// on the round stick under this share of its reach only turns them.
// `lookUpMs`: the round stick held still in its middle this long looks up
// at the sky while held (open call 6; U and Space do it too).
// Step C, the stick men on their own clocks (combat.js clockFrame):
// `wanderMs` / `chaseMs` a tile idle / chasing, times the kind's
// moveEvery. Next to the player one reaches for `reachMs` (a guarded
// HUSK `reachGuardMs`) before it strikes, and lands only if the player is
// still within `reach` tiles, centre to centre (a diagonal neighbour is
// 1.41).
// Step D, the world's beat (REALTIME_STEP_MS): the boss's light still
// spreads a step every LIGHT_TURNS_PER_STEP beats, but its budget and the
// turns a relay or the gate move it were tuned in turns, when a tile
// walked was a turn. One turn of them counts as `lightTurnMs` of real time
// (light.js lightTurnsFor; the creep pace: tune in play). The battery runs
// by time: one charge (a # on the HUD) lasts `batteryChargeMs` on and
// comes back in the same time off (LIGHT_BATTERY_MAX 4 = 12 s).
export const ONE_STICK = {
  on: true,
  walkMs: 450,
  shipWalkMs: 280,    // on the ship (ship plan) the walk is quicker: it is for getting places, not feeling your way (Timothy 2026-10-30)
  sneakMs: 950,
  creep: 0.8,
  turnRate: 7,
  tapMs: 130,
  deadZone: 0.15,
  lookUpMs: 500,
  wanderMs: 950,
  chaseMs: 550,
  reachMs: 600,
  reachGuardMs: 800,
  reach: 1.7,
  lightTurnMs: 950,
  batteryChargeMs: 3000,
  body: 0.28,
  bumpProgress: 0.3,
  bumpRepeatMs: 400,
  frameMs: 50,
};

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
