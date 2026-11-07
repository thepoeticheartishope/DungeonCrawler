// The crew chat over the final boss (boss plan step C): after each move the
// crew says at most one line, picked by CHAT_ORDER, and the speaker is the
// crew member whose tile kind the line is about. A line is
// { kind, slot (0-2, the crew member; null for none), key (text.js),
// vars }; vars.kind is a tile kind and vars.gained the charge per crew
// member, which the view puts in words.
// Called by minigameview.js buildMatch. No DOM access here.

import { state } from './state.js';
import { normalizeSpaces } from './quiz.js';
import { MATCH_BOSS } from './config.js';
import { MATCH_CALL, matchHint, matchHintAt, matchCrisis } from './minigames.js';

// Which line wins when a move has more than one to say, first first (boss
// plan: phase beat > answer > spread warning > miss > crisis cleared >
// chain > charged > cheer). The hint ladder goes just above a miss, since
// it is the help a run of misses needs, and Call's "right kind, wrong
// word" just below it.
export const CHAT_ORDER = ['phase', 'answer', 'spread', 'hint', 'miss', 'wrong', 'freed', 'chain', 'charged', 'cheer'];

// The line among `lines` that comes first in CHAT_ORDER, or null.
export function chatPick(lines) {
  return lines.reduce((best, line) => (!best || CHAT_ORDER.indexOf(line.kind) < CHAT_ORDER.indexOf(best.kind) ? line : best), null);
}

// The set's note on `word` (the note of a question whose answer it is), or
// '' when there is none or it would give away Call's answer: a nudge only
// ever points, never answers.
export function wordNote(board, word) {
  const q = (state.settings.activeData || []).find(row => row.note && normalizeSpaces(row.answer || '') === word);
  return safeNote(board, q && q.note);
}

// `note`, or '' when it is empty or names the answer to `board`'s Call
// question.
function safeNote(board, note) {
  if (!note) return '';
  if (board.ask && note.toLowerCase().includes(board.ask.word.toLowerCase())) return '';
  return note;
}

// The line `board`'s phase starts with (and its one retry, `retried`):
// Sort's by the first crew member, who teaches the board; Dark's by the
// third, whose "Show kinds" matters now; Call's by the owner of the first
// answer's kind.
export function phaseLine(board, retried = false) {
  if (retried) return { kind: 'phase', slot: 1, key: 'boss.chat.retry', vars: {} };
  const slot = board.phase === MATCH_CALL ? (board.ask ? board.ask.kind : 1) : board.phase === 0 ? 0 : 2;
  return { kind: 'phase', slot, key: 'boss.chat.phase.' + board.phase, vars: {} };
}

// Every line the crew could say after one move on `board` (the spread
// warning only near the end: MATCH_BOSS.warnFrom). `move`: `a` and
// `b` the two tiles of a swap that made no line (the tiles, not their
// places: a spread may have taken a place since), `got` matchSwap's result, `turn`
// matchEndTurn's (null when the move won the phase), `hintWas` matchHint
// before the move, `chargeWas` the meters before it, `panic` the ship's.
export function moveLines(board, move) {
  const { a, b, got, turn, hintWas = 0, chargeWas = [0, 0, 0], panic = 0 } = move;
  const lines = [];
  if (got.answered) {
    lines.push({ kind: 'answer', slot: got.answered.kind, key: 'boss.chat.answer', vars: { word: got.answered.word, note: safeNote(board, got.answered.q.note) } });
  }
  if (turn && !turn.lost && board.toSpread === 1 && !board.skip && matchCrisis(board) >= MATCH_BOSS.warnFrom) lines.push({ kind: 'spread', slot: 1, key: 'boss.chat.spread', vars: {} });
  const hint = matchHint(board, panic);
  const at = hint > hintWas ? matchHintAt(board) : null;
  if (at) {
    const how = board.phase === MATCH_CALL ? 'call' : 'dark';
    lines.push({ kind: 'hint', slot: at.kind, key: 'boss.chat.hint.' + how + '.' + hint, vars: { kind: at.kind, row: Math.floor(at.at / MATCH_BOSS.size) + 1 } });
  }
  if (!got.lined && !got.invalid) {
    // The tile the player moved onto speaks, unless it is Call's answer:
    // naming it then would point straight at it.
    const tile = board.ask && b.word === board.ask.word ? a : b;
    lines.push({ kind: 'miss', slot: tile.kind, key: 'boss.chat.miss', vars: { word: tile.word, kind: tile.kind, note: wordNote(board, tile.word) } });
  }
  if (got.wrong && board.ask) {
    lines.push({ kind: 'wrong', slot: board.ask.kind, key: 'boss.chat.wrong', vars: { note: wordNote(board, got.wrong) } });
  }
  if (!got.lined) return lines;
  const gained = [0, 1, 2].map(i => got.waves.reduce((sum, w) => sum + w.gained[i], 0));
  const top = gained.indexOf(Math.max(...gained));
  const freed = got.waves.reduce((sum, w) => sum + w.freed, 0);
  if (freed) lines.push({ kind: 'freed', slot: top, key: 'boss.chat.freed', vars: { n: freed } });
  if (got.waves.length > 1) lines.push({ kind: 'chain', slot: top, key: 'boss.chat.chain', vars: { n: got.waves.length, gained } });
  const charged = [0, 1, 2].find(i => chargeWas[i] < MATCH_BOSS.full && board.charge[i] >= MATCH_BOSS.full);
  if (charged !== undefined) lines.push({ kind: 'charged', slot: charged, key: 'boss.chat.charged', vars: { ability: charged } });
  lines.push({ kind: 'cheer', slot: top, key: 'boss.chat.cheer', vars: { gained } });
  return lines;
}

// The one line the crew says after a move (moveLines, CHAT_ORDER), or null.
export function moveLine(board, move) {
  return chatPick(moveLines(board, move));
}
