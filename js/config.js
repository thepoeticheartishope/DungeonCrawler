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

// Anything further than this many tiles away (in any direction, diagonals
// included) shows as a '?' until the player gets closer — enemies, items
// and furniture alike. The stairs are the exception.
export const REVEAL_DISTANCE = 5;

export const MAX_HEARTS = 3;
// The charger (charger plan, `ideas/reference/dungeon/charger-plan.md` outside the repo;
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
// 2026-10-31: no arrival clock, training period or Timer on questions).
// No burns either (Timothy 2026-11-01, ship minigames plan step G1): the
// run is won by teaching the crew (the final boss comes in step G3). Crew
// panic goes up a step with each failure and down one after `calmStreak`
// right answers in a row while teaching. At each step: 1 Uneasy, 2 Shaken,
// 3 Panicking, `brokenAt` Broken: the run is lost. Panic is only the
// crew's health: it makes nothing harder (Timothy 2026-11-01: no wire
// slips, no harder minigames).
export const SHIP_RUN = {
  calmStreak: 3,
  brokenAt: 4,
  endDelayMs: 900,    // the room's last line shows this long before the end screen
};
// The ship's crew roles (crew roles plan, ideas/crew-roles-plan.md outside
// the repo; Timothy 2026-10-30: a role for each minigame; roles.js). Each
// role's job is `SHIP_JOB.rounds` rounds of its minigame; `passAt` right
// or more and its `benefit` helps the run once, for good:
//   shield     the next failure raises no panic
//   panicDown  panic down a step now
//   calm       calming takes `streak` right answers in a row
// A role sits out a run whose set can't give its minigame
// `SHIP_JOB.minFitting` questions (minigames.js roleCanRun). The Engineer
// is the wires (stations.js), not one of these. Names, rooms and benefits
// are drafts.
export const SHIP_ROLES = [
  { id: 'navigator', minigame: 'starChart', benefit: { kind: 'panicDown' } }, // was Close Enough (step C); was a burn fewer (step G1)
  { id: 'pilot', minigame: 'fuelMix', benefit: { kind: 'shield' } }, // was Higher / Lower (step A); was a burn fewer (step G1)
  { id: 'comms', minigame: 'slowSpell', benefit: { kind: 'shield' } },
  { id: 'medic', minigame: 'syllableSplit', benefit: { kind: 'panicDown' } },
  { id: 'cook', minigame: 'letterPool', benefit: { kind: 'calm', streak: 2 } },
  { id: 'systems', minigame: 'codeBreak', benefit: { kind: 'panicDown' } }, // was fewer wire slips (slips gone 2026-11-01)
  { id: 'science', minigame: 'inference', benefit: { kind: 'shield' } }, // was Verdict (ship minigames plan step E)
  { id: 'quartermaster', minigame: 'crosswire', benefit: { kind: 'panicDown' } }, // was +30s clock
  { id: 'sensors', minigame: 'scanner', benefit: { kind: 'panicDown' } }, // was Fog Reveal (ship minigames plan step B)
  { id: 'lifeSupport', minigame: 'hullPatch', benefit: { kind: 'shield' } }, // was Sum Lock (ship minigames plan step D)
  { id: 'gunner', minigame: 'asteroids', benefit: { kind: 'shield' } }, // new on the Bridge (ship minigames plan step F)
];
// `crew`: how many crew members the player picks to learn and teach in a
// run (Timothy 2026-11-01, ship minigames plan step G2); the Engineer is
// one of the choices.
export const SHIP_JOB = { rounds: 3, passAt: 2, minFitting: 3, learnRounds: 3, crew: 3 }; // learnRounds: at the console, at most this many rounds to learn a role (step B)
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

// All the game's text size (textsize.js), picked from the top bar's TEXT
// button beside SOUND (Timothy 2026-11-01), as a share of the game's own
// sizes (two more smaller ones, Timothy 2026-11-01). Starts on `startAt`
// (100%, the game as drawn) and remembers the player's pick, the scale
// itself (so adding sizes never shifts it), under `storageKey`.
export const TEXT_SIZE = {
  steps: [0.6, 0.7, 0.85, 1, 1.15, 1.3, 1.5],
  startAt: 3,
  storageKey: 'noesisProtocol.textScale',
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
// - boss: "Novum (Good Final Boss, long)" ("Infinity Zero") through the
//   final boss, from the top; its 15:14 is the boss's time limit (Timothy
//   2026-11-01).
// - shipWalk: "Exoplanet" ("Circular Reality") on the ship anywhere
//   outside Command: the walking-around-the-ship music (Timothy
//   2026-11-01). Off the ship there is no music outside the safe room.
//   1:46 long; its ending drops away from about 1:41.
export const MUSIC = {
  shipIntro: { src: './audio/ship-intro-recovery-mission.mp3', volume: 1, fadeInMs: 3000, fadeOutMs: 4000, loop: false },
  safeRoom: { src: './audio/safe-room-nightscape.mp3', volume: 1, fadeInMs: 2000, fadeOutMs: 4000, loop: true, loopEndS: 60, crossfadeS: 5 },
  shipWalk: { src: './audio/ship-walk-exoplanet.mp3', volume: 1, fadeInMs: 2000, fadeOutMs: 4000, loop: true, loopEndS: 100.5, crossfadeS: 4 },
  // The final boss's song: its length is the boss's time limit (MATCH_BOSS.seconds).
  // `resume`: a pause (a hidden tab) picks up where it was, not from the top.
  boss: { src: './audio/boss-novum-final.mp3', volume: 1, fadeInMs: 2000, fadeOutMs: 4000, loop: false, resume: true },
};
// Sound effects (sfx.js), each `volume` a share of the game's volume.
// right / wrong: an answer marked right or wrong, a minigame won or
// missed; wrong also for a wrong move inside a minigame (Timothy 2026-11-01, his chosen sounds: "Retro Event Soft Good"
// and "Retro Event Wrong Simple 03").
export const SFX = {
  sounds: {
    right: { src: './audio/answer-right-soft-good.wav', volume: 0.7 },
    wrong: { src: './audio/answer-wrong-simple-03.wav', volume: 0.7 },
  },
  againMs: 250, // the same sound asked again this soon plays once
};
// How finely music.js draws a fade's curve, and how often it checks which
// tune should be up.
export const MUSIC_FADE_STEPS = 64;
export const MUSIC_CHECK_MS = 250;

// On the ship (Timothy 2026-11-02) Command's shutters are automatic doors,
// with no switch: up while the player is within SHIP_DOOR_REACH tiles of a
// doorway (counting diagonal steps), down otherwise (saferoom.js
// autoShutters).
export const SHIP_DOOR_REACH = 2;
export const SAFE_ROOM = {
  hesitateMs: 1500,
  waitMs: 3000,
  hunterLiftMs: 2500,
  dropMs: 700,
  turnMs: 500,
};
// The longest name the start screen takes, so it fits on one line in a paper.
export const PLAYER_NAME_MAX_LENGTH = 20;
export const PLAYER_CONE_RANGE = 5;
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
export const MAP_DRAG_PX = 8;
// A tap on the floor this close to the player's own tile (in tiles)
// doesn't aim: the angle would jump about under it.
export const LOOK_POINTER_DEAD = 0.35;
// How long a whisper stays on the map before it fades (render.js showWhisper).
export const SENSE_NOTE_MS = 2600;
// How long a tutorial line stays on the map before it fades (slowly: render.js showWhisper).
export const TUTORIAL_WHISPER_MS = 5000;

// Shooting (gun combat plan, step 2; sight.js canShoot): a minion can be
// shot when it is in the player's own light with a clear line to it. A shot
// that can be taken always lands (Timothy, 2026-10-11: the old hit chance by
// distance felt unfair beside the damage bar, which is the skill part).
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
// 1, 5, 10, 100 ... into the engine until it holds the number answer. The
// tanks are the powers of ten up to the answer's own (never fewer than
// 1 / 10 / 100) and `extraTanks` (a 5, Timothy 2026-11-01). Par = the
// fewest pours (950 = 9 x 100 + 5 x 10 = 14; 7 = 5 + 1 + 1 = 3).
// Each vent (going over empties the engine) counts as `ventCost` extra
// pours. Pours over par (plus vents) score: 0 = X, up to `slack2` = 2, up
// to `slack1` = 1; beyond, the engine runs dry: a miss. Whole answers up
// to `maxAnswer`. The slack, and whether the running total hides (only
// UNDER / OVER left), by level (MINIGAME_LEVELS). `ventMs`: how long OVER
// shows before the engine reads empty again.
export const FUEL_MIX = { minTanks: 3, extraTanks: [5], ventCost: 1, maxAnswer: 999999, ventMs: 900 };
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
// miss. The fog's patches by level (MINIGAME_LEVELS): finer, each scan
// shows less; the shares stay.
// Star Chart (ship minigames plan step C; the Navigator's job, in place
// of Close Enough): a one-word answer of `minLetters` to `maxLetters`
// plain letters, its letters as stars among `decoys` decoy stars (letters
// not in the word), `cols` stars across. The player joins them in order;
// a wrong star goes dark for good. Wrong stars: 0 = X, up to `wrong2` = 2,
// up to `maxWrong` = 1, more = a miss. Decoys by level (MINIGAME_LEVELS).
// A drag picks a star only when the finger comes within `dragPx` of its
// middle, so a line that just brushes a star on its way doesn't count.
export const STAR_CHART = { minLetters: 3, maxLetters: 10, cols: 5, wrong2: 2, maxWrong: 4, dragPx: 14 };
// Hull Patch (ship minigames plan step D; Life Support's job, in place of
// Sum Lock): a one-word answer of `minLetters` to `maxLetters` plain
// letters is a hole in the hull; a tray holds its letters once each plus
// decoy letters not in it (by level, MINIGAME_LEVELS). A right plate fills every spot it belongs
// in; a wrong one falls off and the hull takes a strain. Strain 0 = X, up
// to `strain2` = 2, below the level's `maxStrain` = 1; at it the hull
// breaches (a miss). Decoys and strain by level (MINIGAME_LEVELS).
export const HULL_PATCH = { minLetters: 3, maxLetters: 12, decoys: 7, strain2: 2 };
// Each ship minigame gets harder as the player gets good at it (Timothy
// 2026-11-01): every perfect solve (the game's best tier: X, or '2' for
// Syllable Split, which has no X) moves that game up one of its levels
// below, level 0 being the game as it was. Panic plays no part: it only
// ends the run (Timothy 2026-11-01). Inference has its own levels
// (INFERENCE.levels). The perfect solves are counted per run
// (state.run.ship.perfect).
//   starChart     decoys: decoy stars
//   fuelMix       slack2 / slack1: pours over par for tier 2 / 1;
//                 hideTotal: only UNDER / OVER, no running total
//   scanner       cols x rows: the fog's patches (finer shows less a scan)
//   hullPatch     decoys: decoy plates; maxStrain: the strain that breaches
//   asteroids     rocks on the field (a narrow phone flies fewer); shots
//   slowSpell     flip: share of letters drawn upside down or mirrored
//   syllableSplit decoys: decoy pieces; flip: share of pieces flipped
//   letterPool    flip: share of tiles flipped
//   codeBreak     tiers: one guess each; flip: older guesses flipped
//   crosswire     free: the shared letter starts filled in; reveal: REVEAL offered
export const MINIGAME_LEVELS = {
  games: {
    starChart: [{ decoys: 6 }, { decoys: 8 }, { decoys: 10 }, { decoys: 12 }],
    fuelMix: [
      { slack2: 3, slack1: 8, hideTotal: false }, { slack2: 2, slack1: 6, hideTotal: false },
      { slack2: 1, slack1: 5, hideTotal: false }, { slack2: 1, slack1: 5, hideTotal: true },
    ],
    scanner: [{ cols: 5, rows: 4 }, { cols: 6, rows: 5 }, { cols: 8, rows: 6 }, { cols: 10, rows: 8 }],
    hullPatch: [{ decoys: 7, maxStrain: 5 }, { decoys: 9, maxStrain: 4 }, { decoys: 11, maxStrain: 4 }, { decoys: 11, maxStrain: 3 }],
    asteroids: [{ rocks: 4, shots: 3 }, { rocks: 5, shots: 3 }, { rocks: 6, shots: 3 }, { rocks: 6, shots: 2 }],
    slowSpell: [{ flip: 0 }, { flip: 0.25 }, { flip: 0.5 }, { flip: 0.75 }],
    syllableSplit: [{ decoys: 4, flip: 0 }, { decoys: 6, flip: 0 }, { decoys: 8, flip: 0 }, { decoys: 8, flip: 0.4 }],
    letterPool: [{ flip: 0 }, { flip: 0.25 }, { flip: 0.4 }, { flip: 0.6 }],
    codeBreak: [{ tiers: ['X', '2', '1'], flip: false }, { tiers: ['X', '2', '1'], flip: true }, { tiers: ['X', '2'], flip: true }],
    crosswire: [{ free: true, reveal: true }, { free: false, reveal: true }, { free: false, reveal: false }],
  },
};
// Inference (ship minigames plan step E; the Science job, in place of
// Verdict): a number question with a `label` (a short name for its fact,
// "Days Moses spent on the mountain") is worked out from lines of other
// labelled facts; the player never needs to know the facts first
// (Timothy: most of the problem is deduction, the data is given). Each
// fact is a zodiac symbol (zodiac.js). The puzzles grow with the run
// (Timothy 2026-11-01: harder logic as the player learns more algebra):
// every `solvesPerLevel` perfect solves (first CHECK; 2, Timothy
// 2026-11-01), the next of `levels`, each
// { facts (with the answer), ops ('-', 'x', '/', '^': + is always in),
// three (a line can hold a third symbol) }. A line using a level's harder
// ops is picked `hardShare` of the time when one fits; no total over
// `maxTotal`. CHECK marks which lines don't hold with the player's
// numbers; solved on CHECK 1 = X, 2 = 2, up to `maxChecks` = 1, a wrong
// last CHECK is a miss.
export const INFERENCE = {
  levels: [
    { facts: 2, ops: [], three: false },
    { facts: 3, ops: ['-'], three: false },
    { facts: 3, ops: ['-', 'x'], three: true },
    { facts: 4, ops: ['-', 'x', '/'], three: true },
    { facts: 4, ops: ['-', 'x', '/', '^'], three: true },
  ],
  solvesPerLevel: 2, hardShare: 0.75, maxTotal: 2500, maxChecks: 4,
};
// Asteroids (ship minigames plan step F; the Gunner's job, a new role on
// the Bridge, the recognition game in place of Verdict): rocks carry
// whole answers, the question's and decoys (other answers of its kind in
// the set, each the answer to another question). The player turns the
// aim (`aimMax` degrees either way, `aimSpeed` degrees a second while
// held, `aimTap` for a tap) and FIREs along it; the shot hits the first
// rock on the line. Rocks on the field by level (MINIGAME_LEVELS),
// answers of at most `maxChars`; a narrow field gets fewer
// rocks, never smaller ones, and always the right one. Rocks sit on an
// arc, one angle each with `gapDeg` of clear sky between neighbours, and
// drift at most `driftPx`, so none can block another. `shots` shots: a
// wrong rock spends one (and says what it is the answer to), a shot that
// hits nothing is free; shots by level: all left = X, one spent = 2, two
// = 1, none = a miss.
export const ASTEROIDS = {
  rocks: 4, maxChars: 12, // `rocks`: the fewest a field needs (its decoys + 1); on the field and shots by level (MINIGAME_LEVELS)
  aimMax: 75, aimSpeed: 55, aimTap: 2, gapDeg: 2, driftPx: 5, arcMax: 68, arcMin: 8,
  // Rock width: `rockPxWide` from a field `wideAt` px wide, else `rockPx`;
  // smaller (to `rockPxMin`) only when not even 2 fit (Timothy: fewer
  // rocks, not smaller ones). `reach`: how far out rocks sit, as a share
  // of the room each angle has, every other rock (patterns tried in
  // turn). `clearPx`: the gap kept between a rock and the ship's tip.
  turretBottom: 8, turretLength: 18, fieldPx: 240, rockPx: 78, rockPxWide: 96, rockPxMin: 56, wideAt: 520,
  reach: [[0.92, 0.7], [0.7, 0.92], [0.92, 0.92]], clearPx: 10,
};
// The final boss (ship minigames plan step G3): Match, once the player's
// 3rd crew member is taught. A 5 x 5 board of short answers of the set's
// three biggest answer kinds (`minWords` each, at most `maxChars`; by
// category when the kinds can't give three). Swap neighbours to line up 3
// of a kind: matched tiles clear, the rest fall, new ones drop in (new
// tiles never make a line by themselves). A line charges its crew member
// 1 (4 or more: `bonus` more); all three at `full` wins: the ship
// arrives. Each crew member's ability spends their charge. The crisis
// starts on `crisisStart` tiles, spreads one every `spreadEvery` turns; a
// line touching it clears it; `loseAt` crisis tiles loses the run. A
// swap that makes no line snaps back, shows both kinds and spends the
// turn. `seconds`: the time limit, the length of its song (MUSIC.boss,
// "Novum-Good-Final-Boss-Long", 15:14; Timothy's one exception to "no
// timers on the ship"). `popMs` / `dropMs`: the clear and fall, slow.
export const MATCH_BOSS = {
  size: 5, minWords: 6, maxChars: 7, full: 5, bonus: 1, crisisStart: [7, 17], spreadEvery: 2, loseAt: 8,
  revealTurns: 2, seconds: 914, popMs: 300, dropMs: 420,
};
export const SCANNER = { xShare: 0.2, twoShare: 0.4, wrongsAllowed: 1 };
// Sum Lock: a trapped box only. When a trapped box rolls a minigame it is
// Sum Lock if it can be (not twice in a row): its question becomes two
// number questions, whole answers of 1 to SUM_LOCK_MAX_ADDEND, and the
// lock takes only their total. Right pays SUM_LOCK_TIER (the box's gold
// doubled); wrong shows both answers and both come back as haunts. No
// modifiers: a box carries none.
export const SUM_LOCK_MAX_ADDEND = 50;
export const SUM_LOCK_TIER = 'X';

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
// The ship's windows into space (windows.js placeShipWindows, space.js;
// Timothy 2026-11-02): each room gets one, or two with `twoChance` (never
// more), at least `gap` tiles of wall between two. The space picture
// (space.js, ported from Deep-Fold's PixelSpace) is `width` by `height`
// picture pixels, one per run, and each window shows its own part of it.
// `dust` and `nebula` are how many noise cells fit down the picture
// (bigger = smaller clouds), `nebulaAt` how much of the sky the nebula
// covers (0..1, with its pale edge `edge` wider), `stars` one small star
// per this many pixels, `bigStars` and `planets` at most this many.
// `glass`: how bright the view stays under the ship's light (space gives
// its own light, so near full). `drift`: the view scrolls this many
// picture pixels a second, very slowly, to show the ship moving through
// space (Timothy 2026-11-02; the picture wraps across, so `width` must be
// a whole number of `height`s). Still under reduced motion. Walking
// doesn't move the view (he found that disorienting).
export const SHIP_WINDOWS = {
  twoChance: 0.5, gap: 1,
  width: 240, height: 120, dust: 10, nebula: 5, nebulaAt: 0.3, edge: 0.015,
  stars: 150, bigStars: 6, planets: 3, glass: 0.85,
  drift: 0.5,
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
  aimAcrossTall: 15,  // on a map taller than wide (a phone): the whole number nearest this many across, about 7 tiles each side, as desktop shows (Timothy 2026-11-01: phone was pushed in close)
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
// The crew standing at their stations (crew look plan step A, ideas/
// crew-look-plan.md outside the repo): the player's 3D body with no book
// and an ember head that shows where they stand (roles.js crewHeadLook).
// A 'new' head glows `faint`, steady; a ready or taught head breathes like
// the player's (PLAYER_EMBER low..high), one breath every `breathMs`, each
// crew member `stagger` of a breath (and of their idle) after the one
// before, so they don't breathe in step. They face the camera and turn
// slowly to the player while the player is within `turnReach` tiles
// (Timothy 2026-11-02, call 1b), back once the player leaves.
export const CREW_LOOK = { faint: 0.2, breathMs: 4600, stagger: 0.37, turnReach: 2 };
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
// How long each map animation takes, in ms. Looping ones stand still
// under reduced motion.
export const MAP_ANIMATION_MS = {
  bump: 180,        // the player walking into something, out and back
  playerBreath: 2600, // the stick man's chest rising and falling
  playerIdle: 3000, // how long the player stands without moving or turning before the stick man starts glancing round (playerform.js, PLAYER_GLANCE)
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
// The room log keeps this many notes, newest at the bottom: all of them
// show when LOG opens it over the map; otherwise only the newest two sit on
// the map's bottom edge (index.html .feedback, nth-last-child(-n+2)), and
// dim ROOM_LOG_DIM_MS after the last one came.
export const ROOM_LOG_LINES = 20;
export const ROOM_LOG_DIM_MS = 6000;
export const REALTIME_POLL_MS = 100;

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

// Free walking (one stick plan, ideas/one-stick-plan.md outside the repo):
// the player walks freely in real time (walk.js), not tile to tile; the
// only way since dungeon removal step E1. `walkMs` / `sneakMs`: ms to walk / creep one
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
export const ONE_STICK = {
  walkMs: 450,
  shipWalkMs: 280,    // on the ship (ship plan) the walk is quicker: it is for getting places, not feeling your way (Timothy 2026-10-30)
  sneakMs: 950,
  creep: 0.8,
  turnRate: 7,
  tapMs: 130,
  deadZone: 0.15,
  lookUpMs: 500,
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
