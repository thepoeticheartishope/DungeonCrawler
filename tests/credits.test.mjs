// Credits at the game's end (1.0 checklist D): both end screens list the
// credits, every credit line has its text, and Jeremy Blake is named
// (his licence asks for it).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TEXT } from '../js/text.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function section(id) {
  const m = html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`));
  assert.ok(m, `no #${id}`);
  return m[0];
}

test('both end screens carry the credits, each line with its text', () => {
  for (const id of ['winScreen', 'loseScreen']) {
    const keys = [...section(id).matchAll(/data-t="(credits\.[^"]+)"/g)].map(m => m[1]);
    assert.ok(keys.includes('credits.music'), `${id} has no music credit`);
    for (const k of keys) assert.ok(TEXT[k], `${id}: no text for ${k}`);
  }
});

test('the music credit names Jeremy Blake and all four tracks', () => {
  for (const s of ['Jeremy Blake', 'Recovery Mission', 'Nightscape', 'Exoplanet', 'Novum']) {
    assert.ok(TEXT['credits.music'].includes(s), s);
  }
});
