// The ship's furniture from a file (room sprites plan step A,
// ideas/room-sprites-plan.md outside the repo; Timothy 2026-11-06):
// rooms/ship.json lists each room's furniture, so Timothy can move, add or
// remove pieces by editing one file and reloading. plans.js keeps the walls
// and the stations, and its own furniture is the fallback: a missing or
// broken file never leaves the ship bare. main.js calls loadShipRooms()
// once at start, before the ship is built.

import { FLOOR_PLANS } from './plans.js';

// Warnings go to the console only with ?dev on the address (devpanel.js).
export function devWarn(message) {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev')) console.warn('rooms: ' + message);
}

// One piece as the file gives it: ["piece", row, col] or ["piece", row, col, width].
function goodPiece(p) {
  return Array.isArray(p) && typeof p[0] === 'string' && p[0] !== ''
    && Number.isInteger(p[1]) && Number.isInteger(p[2])
    && (p.length === 3 || (p.length === 4 && Number.isInteger(p[3]) && p[3] >= 1));
}

// Puts the file's furniture (data = the parsed rooms/ship.json) on the
// plan's rooms, matched by name. A room the file leaves out keeps its
// plans.js furniture; a bad piece is skipped. Returns the warnings.
export function applyRoomFurniture(plan, data) {
  if (!data || !Array.isArray(data.rooms)) return ['ship.json has no "rooms" list; using plans.js furniture'];
  const warnings = [];
  const byName = new Map(plan.rooms.map(room => [room.name, room]));
  data.rooms.forEach(entry => {
    const room = entry && byName.get(entry.name);
    if (!room) { warnings.push('no room named ' + JSON.stringify(entry && entry.name)); return; }
    if (!Array.isArray(entry.furniture)) { warnings.push(entry.name + ': no "furniture" list'); return; }
    room.furniture = entry.furniture.filter(p => {
      if (goodPiece(p)) return true;
      warnings.push(entry.name + ': skipped bad piece ' + JSON.stringify(p));
      return false;
    });
  });
  return warnings;
}

// Fetches rooms/ship.json and puts its furniture on the ship's plan. On
// any failure the plan keeps its own furniture and DEV says so.
export async function loadShipRooms() {
  try {
    const res = await fetch('rooms/ship.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    applyRoomFurniture(FLOOR_PLANS.ship, await res.json()).forEach(devWarn);
  } catch (err) {
    devWarn('rooms/ship.json not loaded (' + err.message + '); using plans.js furniture');
  }
}
