// Static game data and tunable constants. Nothing here changes at runtime —
// mutable game state lives in state.js instead.

// ---- Sample data. Replaced at runtime if the player loads their own list. ----
// Each entry needs a "term" and its "meaning".
// "category" and "difficulty" are optional. When present, category groups
// entries into a world-placed vocab encounter (see main.js loadRoom), and
// difficulty ("easy"/"medium"/"hard") scales that encounter's coin reward.
export const TYPING_SAMPLE_DATA = [
  { term: "CPU", meaning: "Central Processing Unit", category: "Hardware", difficulty: "easy" },
  { term: "RAM", meaning: "Random Access Memory", category: "Hardware", difficulty: "easy" },
  { term: "SSD", meaning: "Solid State Drive", category: "Hardware", difficulty: "medium" },
  { term: "DNS", meaning: "Domain Name System", category: "Networking", difficulty: "medium" }
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

// Classic roguelike convention: uppercase for bosses, lowercase for minions.
export const BOSS_ICONS = ['D', 'T', 'O', 'B', 'S', 'W', 'C', 'V'];
export const MINION_ICONS = ['a', 'b', 'r', 'w'];

// Symbols for category-tagged vocab encounters — distinct from the letters
// used by bosses/minions, since these represent a learning choice, not a
// monster. glyphForCategory() in quiz.js picks one deterministically from
// a category's name, so the same category always renders the same symbol.
export const ENCOUNTER_GLYPHS = ['?', '!', '$', '%', '&', '*', '+', '~', '^', '='];

export const PLAYER_ICON = '@';

// Coins awarded for correctly answering a vocab encounter, by the
// question's own difficulty tier. Falls back to "medium" if a question is
// missing or has an invalid difficulty.
export const DIFFICULTY_COIN_REWARD = { easy: 1, medium: 2, hard: 3 };

// Grid size and chamber count both grow as the run progresses.
// Index 0 = Room 1, index 1 = Room 2, index 2 = Room 3.
export const GRID_SIZES = [19, 23, 27];
export const CHAMBER_TARGETS = [6, 8, 10];

export const MAX_HEARTS = 3;
export const ROOM_COUNT = 3;

export const BOSS_HP = 3;       // hits needed to defeat the boss
export const MINION_HP = 1;     // hits needed to defeat one minion
export const SPAWN_INTERVAL = 7; // turns between the boss summoning a minion
export const MAX_MINIONS = 3;    // hard cap so minions can't snowball

export const VISION_RADIUS = 5; // how many open-floor steps the player can see

// The camera always renders a fixed VIEWPORT_SIZE x VIEWPORT_SIZE window of
// the room, panning to follow the player. Must stay smaller than every
// value in GRID_SIZES, or there'd be nothing to pan.
export const VIEWPORT_SIZE = 9;
