// The player's light on a battery (light battery plan step A). The light
// goes on and off (V) at no cost. Each turn on spends 1 charge and each
// turn off gives 1 back, up to LIGHT_BATTERY_MAX (with One stick, by time:
// drainLight). Run it all the way out
// and it goes off by itself and stays locked off until it is full again;
// switched off by hand with charge left, it can come back on any time.
// Off, the player sees only the small circle round them (sight.js).
// Comfort mode (state.settings.simpleEnemies), DEV -> Light battery off and
// the ship leave the light always on, as it was. Rules only — no DOM access here.

import { state } from './state.js';
import { LIGHT_BATTERY_MAX, LOW_BATTERY_CHARGE, ONE_STICK } from './config.js';

// A full battery with the light on, for a new floor (every floor, rest
// floors too, starts full: mockup call 6).
export function freshLight() {
  return { on: true, charge: LIGHT_BATTERY_MAX, locked: false };
}

// Whether the battery is in play at all. Never on the ship (Timothy
// 2026-11-01: the light button goes, to save room; the ship is lit).
export function batteryInPlay() {
  return state.settings.lightBattery && !state.settings.simpleEnemies && !(state.floor && state.floor.ship);
}

// Whether the player's cone is lit right now. Always, with the battery
// out of play.
export function lightOn() {
  return !batteryInPlay() || state.floor.light.on;
}

// Whether the battery is low (kill or maim plan): in play, the light on,
// and LOW_BATTERY_CHARGE charge or less left. A shot's dial then hides its
// dark arc, as a shot in the dark does.
export function lowBattery() {
  return batteryInPlay() && state.floor.light.on && state.floor.light.charge <= LOW_BATTERY_CHARGE;
}

// One turn of the battery, from combat.js advanceMonsters before anything
// moves. With One stick the battery runs by time instead (drainLight), so
// the world's beat leaves it alone. Events: runLight's.
export function tickLight() {
  if (state.settings.oneStick) return [];
  return runLight(1);
}

// One stick (one stick plan step D): the battery runs for `dtMs` of real
// time, a charge every ONE_STICK.batteryChargeMs, on or off. Called by
// combat.js clockFrame every frame the world runs. Events: runLight's.
export function drainLight(dtMs) {
  return runLight(dtMs / ONE_STICK.batteryChargeMs);
}

// The battery runs `amount` charges: on, it spends them; off, it gets them
// back, up to LIGHT_BATTERY_MAX (not in the safe room). Returns the events it caused: 'lightDied'
// when the charge runs out with the light on, 'lightCharged' when a locked
// light is full again.
function runLight(amount) {
  if (!batteryInPlay()) return [];
  const light = state.floor.light;
  // The tutorial's light is steady (tutorial.js): it never runs down or charges.
  if (light.steady) return [];
  if (light.on) {
    light.charge = Math.max(light.charge - amount, 0);
    if (light.charge > 0) return [];
    light.on = false;
    light.locked = true;
    return [{ type: 'lightDied' }];
  }
  if (light.charge >= LIGHT_BATTERY_MAX) return [];
  // Off in the safe room (saferoom.js), it doesn't charge: the room keeps
  // the player alive, it doesn't refill them.
  const safe = state.floor.safeRoom;
  if (safe && safe.playerIn) return [];
  light.charge = Math.min(light.charge + amount, LIGHT_BATTERY_MAX);
  if (light.charge < LIGHT_BATTERY_MAX || !light.locked) return [];
  light.locked = false;
  return [{ type: 'lightCharged' }];
}

// Switch the light (no turn spent). Returns what happened: 'on', 'off',
// 'locked' (empty and not full again yet, so it stays off), 'held' (on in
// the tutorial's fight, so it stays on: no dark shot there, Timothy
// 2026-10-17) or null with the battery out of play.
export function toggleLight() {
  if (!batteryInPlay()) return null;
  const light = state.floor.light;
  if (!light.on && light.locked) return 'locked';
  if (light.on && state.floor.tutorial && state.floor.tutorial.stage === 'fight') return 'held';
  light.on = !light.on;
  return light.on ? 'on' : 'off';
}

// Turns of charging left before a locked light can come back on (with
// One stick, seconds: secondsToFull).
export function turnsToFull() {
  return Math.ceil(LIGHT_BATTERY_MAX - state.floor.light.charge);
}

// One stick: seconds of charging left before a locked light can come back on.
export function secondsToFull() {
  return Math.ceil((LIGHT_BATTERY_MAX - state.floor.light.charge) * ONE_STICK.batteryChargeMs / 1000);
}
