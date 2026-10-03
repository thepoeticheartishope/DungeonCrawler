// Stem check: for every bundled set, how many questions a stem cue covers
// (STEM_CUES in js/config.js: "Who…?" -> person types, "How many…?" ->
// number, ...) and which tagged questions have a type their stem doesn't
// allow. The tag wins in play (buildChoices ignores the stem then), so each
// listed question is either a tagging mistake to fix or a real exception
// to leave. Reports only; it changes nothing and always exits 0.
//
//   node tools/stem_check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stemTypes } from '../js/quiz.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'lists', 'manifest.json'), 'utf8'));

for (const set of manifest) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'lists', set.file), 'utf8'));
  let covered = 0;
  const conflicts = [];
  data.forEach((q, i) => {
    const types = stemTypes(q.term);
    if (!types) return;
    covered++;
    if (q.answerType && !types.includes(q.answerType)) conflicts.push({ n: i + 1, q, types });
  });
  console.log(`== ${set.file}: ${covered} of ${data.length} questions have a stem cue, ${conflicts.length} tagged outside it`);
  for (const { n, q, types } of conflicts) {
    console.log(`  #${n} [${q.answerType}] ${q.term.slice(0, 80)}`);
    console.log(`      answer: ${q.meaning}; the stem allows: ${types.join(', ')}`);
  }
}
