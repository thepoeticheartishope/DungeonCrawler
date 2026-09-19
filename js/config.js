// Static game data and tunable constants. Nothing here changes at runtime —
// mutable game state lives in state.js instead.

// ---- Sample data. Replaced at runtime if the player loads their own list. ----
// Each entry needs a "term" and its "meaning".
export const TYPING_SAMPLE_DATA = [
  { term: "CPU", meaning: "Central Processing Unit" },
  { term: "RAM", meaning: "Random Access Memory" },
  { term: "SSD", meaning: "Solid State Drive" },
  { term: "DNS", meaning: "Domain Name System" }
];

export const MC_SAMPLE_DATA = [
  {
    term: "RAID",
    meaning: "Redundant Array of Independent Disks",
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
    options: [
      "Dynamic Host Configuration Protocol",
      "Direct Hardware Control Panel",
      "Distributed Host Connection Process",
      "Dynamic Hardware Configuration Program"
    ]
  }
];

export const BOSS_ICONS = ['👹', '🐉', '🧟', '👺', '🐍', '👻', '🦂', '🕷️'];
export const MINION_ICONS = ['👾', '🦇', '🐀', '🐛'];

// Grid size and chamber count both grow as the run progresses.
// Index 0 = Room 1, index 1 = Room 2, index 2 = Room 3.
export const GRID_SIZES = [11, 13, 15];
export const CHAMBER_TARGETS = [4, 5, 6];

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
