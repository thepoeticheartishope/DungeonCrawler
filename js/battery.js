// The player's light on a battery (light battery plan step A). The light
// goes on and off (V) at no cost. Each turn on spends 1 charge and each
// turn off gives 1 back, up to LIGHT_BATTERY_MAX. Run it all the way out
// and it goes off by itself and stays locked off until it is full again;
// switched off by hand with charge left, it can come back on any time.
// Off, the player sees only the small circle round them (sight.js).
// Comfort mode (state.settings.simpleEnemies) and DEV -> Light battery off
// leave the light always on, as it was. Rules only — no DOM access here.

import { state } from './state.js';
import { LIGHT_BATTERY_MAX } from './config.js';

// A full battery with the light on, for a new floor (every floor, rest
// floors too, starts full: mockup call 6).
export function freshLight() {
  return { on: true, charge: LIGHT_BATTERY_MAX, locked: false };
}

// Whether the battery is in play at all.
export function batteryInPlay() {
  return state.settings.lightBattery && !state.settings.simpleEnemies;
}

// Whether the player's cone is lit right now. Always, with the battery
// out of play.
export function lightOn() {
  return !batteryInPlay() || state.floor.light.on;
}

// One turn of the battery, from combat.js advanceMonsters before anything
// moves. Returns the events it caused: 'lightDied' when the charge runs
// out with the light on, 'lightCharged' when a locked light is full again.
export function tickLight() {
  if (!batteryInPlay()) return [];
  const light = state.floor.light;
  if (light.on) {
    light.charge = Math.max(light.charge - 1, 0);
    if (light.charge > 0) return [];
    light.on = false;
    light.locked = true;
    return [{ type: 'lightDied' }];
  }
  if (light.charge >= LIGHT_BATTERY_MAX) return [];
  light.charge++;
  if (light.charge < LIGHT_BATTERY_MAX || !light.locked) return [];
  light.locked = false;
  return [{ type: 'lightCharged' }];
}

// Switch the light (no turn spent). Returns what happened: 'on', 'off',
// 'locked' (empty and not full again yet, so it stays off) or null with
// the battery out of play.
export function toggleLight() {
  if (!batteryInPlay()) return null;
  const light = state.floor.light;
  if (!light.on && light.locked) return 'locked';
  light.on = !light.on;
  return light.on ? 'on' : 'off';
}

// Turns of charging left before a locked light can come back on.
export function turnsToFull() {
  return LIGHT_BATTERY_MAX - state.floor.light.charge;
}
